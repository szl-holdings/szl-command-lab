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
# consensus, restraint and governance modules. Exact Git SHA is intentionally pinned.
RUN python -m pip install --no-cache-dir "https://github.com/szl-holdings/szl-substrate/archive/ad2e04374717ef79dbf7dbb91aea5a8480ed10c3.tar.gz"

COPY server.py ./server.py
COPY gateway.py ./gateway.py
COPY space/index.html ./index.html
COPY space/launchpad.html ./launchpad.html

EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:7860/healthz', timeout=4)"

CMD ["python", "-u", "gateway.py"]
