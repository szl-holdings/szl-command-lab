# SPDX-License-Identifier: Apache-2.0
"""Synthetic counter fault controls. No actual GPU, powercap or provider calls."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import atlas_energy as energy

READ_RAPL = energy._read_rapl
READ_NVML = energy._read_nvml


def sample(value, source="intel-rapl", identity="synthetic-counter"):
    return energy._Counter(source, identity, value)


@pytest.fixture(autouse=True)
def no_hardware(monkeypatch):
    monkeypatch.setattr(energy, "_read_rapl", Mock(return_value=None))
    monkeypatch.setattr(energy, "_read_nvml", Mock(return_value=None))
    monkeypatch.setattr(energy, "_cuda_inventory", Mock(side_effect=AssertionError("No hardware inventory during a probe")))
    monkeypatch.setattr(energy.time, "sleep", Mock())


def assert_unavailable(payload):
    assert payload["honesty"] == "UNAVAILABLE"
    for field in ("package_energy_j", "sample_delta_j", "inference_energy_j", "energy_j"):
        assert payload[field] is None
    assert payload["attribution"] == "NOT_ISOLATED_TO_CALLABLE"
    json.dumps(payload, allow_nan=False)


@pytest.mark.parametrize("invalid", [None, -1, True, False, "0", float("nan"), float("inf"), -float("inf"), 2**64, 10**500])
def test_invalid_counter_values_are_not_measurements(invalid):
    assert not energy._valid_value(invalid)
    assert energy._delta(sample(1), sample(invalid)) is None
    assert energy._delta(sample(invalid), sample(2)) is None


@pytest.mark.parametrize("start,end,expected", [(0, 0, 0.0), (10, 10, 0.0), (1000, 2500, 0.0015)])
def test_valid_rapl_deltas_preserve_real_zero(start, end, expected):
    assert energy._delta(sample(start), sample(end)) == expected


def test_numerically_equal_values_do_not_admit_different_identities():
    assert energy._delta(sample(100), sample(200, identity="another-counter")) is None
    assert energy._delta(sample(100), sample(200, source="nvml")) is None


@pytest.mark.parametrize("end", [None, sample(500), sample(-1), sample(float("nan")), sample(2000, identity="other")])
def test_probe_rejects_missing_decreasing_or_changed_second_read(end):
    energy._read_rapl.side_effect = [sample(1000), end]
    assert_unavailable(energy.probe(sample_s=0))
    energy._read_rapl.assert_any_call("synthetic-counter")
    energy._read_nvml.assert_not_called()


def test_probe_valid_zero_is_not_treated_as_missing():
    energy._read_rapl.side_effect = [sample(1000), sample(1000)]
    out = energy.probe(sample_s=0)
    assert out["honesty"] == "MEASURED"
    assert out["sample_delta_j"] == 0.0
    assert out["inference_energy_j"] is None
    assert out["energy_j"] is None


def test_nvml_snapshot_is_not_a_wrapped_call_measurement():
    energy._read_nvml.return_value = sample(2500, source="nvml")
    out = energy.probe(sample_s=0)
    assert out["package_energy_j"] == 2.5
    assert out["measurement_scope"] == "DEVICE_COUNTER_SNAPSHOT"
    assert out["sample_delta_j"] is None
    assert out["energy_j"] is None


@pytest.mark.parametrize("invalid", [-1, True, "0", float("nan"), float("inf"), 1.1])
def test_sampling_delay_is_validated_before_any_hardware_read(invalid):
    with pytest.raises(ValueError):
        energy.probe(sample_s=invalid)
    energy._read_rapl.assert_not_called()
    energy._read_nvml.assert_not_called()


@pytest.mark.parametrize("end", [None, sample(500), sample(float("inf")), sample(2000, identity="other")])
def test_wrapped_invalid_interval_is_not_replaced_by_post_run_probe(end, monkeypatch):
    energy._read_rapl.side_effect = [sample(1000), end]
    monkeypatch.setattr(energy, "probe", Mock(side_effect=AssertionError("A later probe cannot repair a missing interval")))
    fn = Mock(return_value="result")
    result, out = energy.measure_run(fn)
    assert result == "result"
    fn.assert_called_once_with()
    assert_unavailable(out)
    assert out["duration_s"] >= 0
    assert energy._read_rapl.call_count == 2


def test_missing_start_cannot_be_supplied_after_the_call():
    energy._read_rapl.side_effect = [None, sample(9999)]
    result, out = energy.measure_run(lambda: 7)
    assert result == 7
    assert_unavailable(out)
    assert energy._read_rapl.call_count == 1


def test_valid_nvml_interval_can_survive_independent_rapl_failure():
    energy._read_rapl.side_effect = [sample(1000), None]
    energy._read_nvml.side_effect = [sample(1000, "nvml", "gpu-a"), sample(1500, "nvml", "gpu-a")]
    _, out = energy.measure_run(lambda: None)
    assert out["honesty"] == "MEASURED"
    assert out["source"] == "nvml"
    assert out["energy_j"] == out["inference_energy_j"] == 0.5
    assert out["sample_delta_j"] is None
    assert out["attribution"] == "NOT_ISOLATED_TO_CALLABLE"
    energy._read_nvml.assert_any_call("gpu-a")


@pytest.mark.parametrize("end", [None, sample(500, "nvml", "gpu-a"), sample(1500, "nvml", "gpu-b")])
def test_nvml_incomplete_reset_or_device_switch_is_unavailable(end):
    energy._read_nvml.side_effect = [sample(1000, "nvml", "gpu-a"), end]
    _, out = energy.measure_run(lambda: None)
    assert_unavailable(out)


def test_callable_exception_propagates_without_a_success_receipt():
    fn = Mock(side_effect=ValueError("synthetic callable failure"))
    with pytest.raises(ValueError, match="synthetic callable failure"):
        energy.measure_run(fn)
    fn.assert_called_once_with()
    assert energy._read_rapl.call_count == energy._read_nvml.call_count == 1


def test_rapl_reader_does_not_switch_to_a_different_file(tmp_path, monkeypatch):
    first, second = tmp_path / "first", tmp_path / "second"
    first.write_text("1000\n", encoding="ascii")
    second.write_text("2000\n", encoding="ascii")
    monkeypatch.setattr(energy, "RAPL", first)
    monkeypatch.setattr(energy, "POWERCAP", tmp_path / "absent")
    start = READ_RAPL()
    first.unlink()  # Test-owned temporary fixture only.
    monkeypatch.setattr(energy, "RAPL", second)
    assert READ_RAPL(start.identity) is None
    assert READ_RAPL().identity == str(second.resolve())


@pytest.mark.parametrize("raw", ["-1", "NaN", "Infinity", "9" * 64, "not-a-counter", str(2**64)])
def test_rapl_reader_rejects_invalid_file_values(raw, tmp_path, monkeypatch):
    path = tmp_path / "counter"
    path.write_text(raw, encoding="ascii")
    monkeypatch.setattr(energy, "RAPL", path)
    monkeypatch.setattr(energy, "POWERCAP", tmp_path / "absent")
    assert READ_RAPL() is None


def test_nvml_reader_pins_uuid_and_always_releases_library():
    fake = SimpleNamespace(nvmlInit=Mock(), nvmlShutdown=Mock(),
        nvmlDeviceGetHandleByIndex=Mock(return_value="handle"),
        nvmlDeviceGetHandleByUUID=Mock(return_value="handle"),
        nvmlDeviceGetUUID=Mock(return_value=b"GPU-synthetic"),
        nvmlDeviceGetTotalEnergyConsumption=Mock(return_value=2000))
    with patch.dict(sys.modules, {"pynvml": fake}):
        observed = READ_NVML("GPU-synthetic")
        assert observed == sample(2000, "nvml", "GPU-synthetic")
        fake.nvmlDeviceGetHandleByUUID.assert_called_once_with("GPU-synthetic")
        fake.nvmlDeviceGetHandleByIndex.assert_not_called()
        fake.nvmlShutdown.assert_called_once_with()
        fake.nvmlDeviceGetUUID.return_value = "GPU-another"
        assert READ_NVML("GPU-synthetic") is None
        fake.nvmlDeviceGetTotalEnergyConsumption.assert_called_once()
        assert fake.nvmlShutdown.call_count == 2


@pytest.mark.parametrize("relative", ["python/energy.py", "space/energy.py", "server.py"])
def test_every_entrypoint_uses_the_same_counter_contract(relative):
    spec = importlib.util.spec_from_file_location("isolated_energy_entrypoint", ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {"energy": None, "kernel": None}):
        spec.loader.exec_module(module)
    assert module.probe is energy.probe
    assert module.measure_run is energy.measure_run


def test_canonical_publisher_includes_energy_owner_and_trigger():
    docker = (ROOT / "Dockerfile").read_text(encoding="utf-8")
    workflow = (ROOT / ".github/workflows/hf-sync.yml").read_text(encoding="utf-8")
    assert "COPY atlas_energy.py ./atlas_energy.py" in docker
    assert "      - atlas_energy.py" in workflow
    assert "require-default-branch-tip: true" in workflow
    assert "cancel-in-progress: false" in workflow


def test_ui_states_shared_counter_attribution_limit():
    html = (ROOT / "space/index.html").read_text(encoding="utf-8")
    assert "Shared hardware counters; not isolated inference energy." in html


@pytest.mark.parametrize("counter", [None, {}, sample(1, source=[]), sample(1, source="unknown"), sample(1, identity=""), sample(1, identity=3)])
def test_malformed_reading_objects_fail_closed(counter):
    assert not energy._valid_counter(counter)
    assert energy._delta(counter, sample(2)) is None


def test_wrapped_valid_rapl_interval_preserves_units_and_result():
    energy._read_rapl.side_effect = [sample(1_000_000), sample(1_250_000)]
    result = object()
    observed, out = energy.measure_run(lambda: result)
    assert observed is result
    assert out["energy_j"] == out["inference_energy_j"] == 0.25
    assert out["package_energy_j"] == 1.25
    assert out["measurement_scope"] == "PACKAGE_COUNTER_INTERVAL"
    assert out["sample_delta_j"] is None
    json.dumps(out, allow_nan=False)


@pytest.mark.parametrize("invalid", [-1, True, float("nan"), float("inf"), 2**64])
def test_nvml_invalid_counters_are_unavailable_and_library_is_released(invalid):
    fake = SimpleNamespace(nvmlInit=Mock(), nvmlShutdown=Mock(),
        nvmlDeviceGetHandleByIndex=Mock(return_value="handle"),
        nvmlDeviceGetUUID=Mock(return_value="GPU-synthetic"),
        nvmlDeviceGetTotalEnergyConsumption=Mock(return_value=invalid))
    with patch.dict(sys.modules, {"pynvml": fake}):
        assert READ_NVML() is None
    fake.nvmlShutdown.assert_called_once_with()


def test_nvml_driver_failure_is_unavailable_and_releases_library():
    fake = SimpleNamespace(nvmlInit=Mock(), nvmlShutdown=Mock(),
        nvmlDeviceGetHandleByIndex=Mock(side_effect=RuntimeError("synthetic driver failure")))
    with patch.dict(sys.modules, {"pynvml": fake}):
        assert READ_NVML() is None
    fake.nvmlShutdown.assert_called_once_with()


def test_energy_api_serializes_missing_sample_as_null_joules():
    import server
    energy._read_rapl.side_effect = [sample(1000), None]
    handler = object.__new__(server.Handler)
    handler.path = "/api/energy"
    handler._send_json = Mock()
    handler.do_GET()
    handler._send_json.assert_called_once()
    status, payload = handler._send_json.call_args.args
    assert status == 200  # The observation endpoint works; the measurement is unavailable.
    assert_unavailable(payload)


@pytest.mark.parametrize("phase", ["init", "shutdown"])
def test_nvml_lifecycle_failures_cannot_publish_an_observation(phase):
    fake = SimpleNamespace(nvmlInit=Mock(), nvmlShutdown=Mock(),
        nvmlDeviceGetHandleByIndex=Mock(return_value="handle"),
        nvmlDeviceGetUUID=Mock(return_value="GPU-synthetic"),
        nvmlDeviceGetTotalEnergyConsumption=Mock(return_value=2000))
    failed = fake.nvmlInit if phase == "init" else fake.nvmlShutdown
    failed.side_effect = RuntimeError("synthetic lifecycle failure")
    with patch.dict(sys.modules, {"pynvml": fake}):
        assert READ_NVML() is None
    if phase == "init":
        fake.nvmlShutdown.assert_not_called()
    else:
        fake.nvmlShutdown.assert_called_once_with()


def test_rapl_enumeration_failure_retains_only_the_explicit_candidate(tmp_path, monkeypatch):
    counter = tmp_path / "default_counter"
    counter.write_text("500\n", encoding="ascii")
    monkeypatch.setattr(energy, "RAPL", counter)
    with patch.object(Path, "is_dir", side_effect=OSError("synthetic enumeration failure")):
        assert READ_RAPL() == sample(500, identity=str(counter.resolve()))


def test_hardware_inventory_errors_have_explicit_unavailable_states():
    # Recover the real inventory function from the source rather than unpatching
    # the autouse safety boundary for normal energy probes.
    spec = importlib.util.spec_from_file_location("isolated_inventory_contract", ROOT / "atlas_energy.py")
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {spec.name: module, "torch": None}):
        spec.loader.exec_module(module)
        with patch.object(module.subprocess, "run", side_effect=OSError("synthetic CLI absence")):
            out = module._cuda_inventory()
    assert out["torch_inventory_state"] == "UNAVAILABLE"
    assert out["driver_inventory_state"] == "UNAVAILABLE"
    assert out["nvidia_smi"] is None
    assert out["cuda_available"] is False
