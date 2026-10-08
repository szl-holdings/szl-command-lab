# Operational SZL Atlas Space — stdlib Python transport, no Node runtime.
# GCR pin: HF builders fail public.ecr.aws with exit 128. Anatomy already runs this FROM.
# Dockerfile-derived Hub payload: server.py + gateway.py + Atlas/Launchpad HTML + README.
# Digest-pinned OCI index for python:3.14-slim (3.14.7-slim-trixie, linux/amd64 included),
# identical on mirror.gcr.io and registry-1.docker.io when resolved 2026-09-29.
# Dependabot (docker ecosystem, directory "/") keeps the tag and digest moving together.
FROM mirror.gcr.io/library/python:3.14-slim@sha256:c3e521df8b2b498a7a682e7e18676771cb80c6b75b8699af886b2d554ce40151

WORKDIR /app
ENV HOST=0.0.0.0
ENV PORT=7860
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Shared source-of-truth for the second brain, Anatomy, formula wiring, receipts,
# consensus, restraint and governance modules. Exact Git SHAs are intentionally pinned.
ARG YARQA_REVISION=a5e74026ee0c24f45a0b0405ee849720ca520302
ARG YARQA_ARCHIVE_SHA256=8aa133830078eb519d0806ce197ec45d62f19fe363ac5d1d968a65705c315483
ARG NUMPY_VERSION=2.5.2
ENV SZL_YARQA_SHA=${YARQA_REVISION}
RUN python -m pip install --no-cache-dir \
      "https://github.com/szl-holdings/szl-substrate/archive/ad2e04374717ef79dbf7dbb91aea5a8480ed10c3.tar.gz" \
      "numpy==${NUMPY_VERSION}" \
      "https://github.com/szl-holdings/yarqa/archive/${YARQA_REVISION}.tar.gz#sha256=${YARQA_ARCHIVE_SHA256}" \
    && python -I -c "import yarqa; assert yarqa.__version__ == '0.5.0'"

COPY requirements-public-demos.txt ./requirements-public-demos.txt
RUN python -m pip install --no-cache-dir --require-hashes --only-binary=:all: -r requirements-public-demos.txt \
    && python -I -c "from importlib.metadata import version; assert version('szl-retrieval-bench') == '0.3.1'; assert version('szl-guardrail-receipt') == '0.1.2'"

COPY server.py ./server.py
COPY atlas_energy.py ./atlas_energy.py
COPY gateway.py ./gateway.py
COPY launchpad_views.py ./launchpad_views.py
COPY demo_adapters.py ./demo_adapters.py
COPY visitor_views.py ./visitor_views.py
COPY demo_data ./demo_data
COPY space/index.html ./index.html
COPY space/launchpad.html ./launchpad.html
COPY space/szl-holo-v2.css ./szl-holo-v2.css
COPY space/szl-holo-v2.js ./szl-holo-v2.js

EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:7860/healthz', timeout=4)"

CMD ["python", "-u", "gateway.py"]
