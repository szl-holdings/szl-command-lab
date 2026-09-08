# Operational SZL Atlas Space — stdlib Python transport, no Node runtime.
# GCR pin: HF builders fail public.ecr.aws with exit 128. Anatomy already runs this FROM.
# Dockerfile-derived Hub payload: server.py + gateway.py + Atlas/Launchpad HTML + README.
FROM mirror.gcr.io/library/python:3.12-slim

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

COPY server.py ./server.py
COPY gateway.py ./gateway.py
COPY space/index.html ./index.html
COPY space/launchpad.html ./launchpad.html
COPY space/szl-holo-v2.css ./szl-holo-v2.css
COPY space/szl-holo-v2.js ./szl-holo-v2.js

EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:7860/healthz', timeout=4)"

CMD ["python", "-u", "gateway.py"]
