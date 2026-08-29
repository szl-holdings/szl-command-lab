# Operational Command lab Space — stdlib Python hologram, no npm.
# GCR pin: HF builders fail public.ecr.aws with exit 128. Anatomy already runs this FROM.
# Flatten-compatible: Hub payload is Dockerfile + server.py + index.html + README (immune mirrors space/ → root).
FROM mirror.gcr.io/library/python:3.12-slim

WORKDIR /app
ENV HOST=0.0.0.0
ENV PORT=7860
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

COPY server.py ./server.py
COPY index.html ./index.html

EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:7860/healthz', timeout=4)"

CMD ["python", "-u", "server.py"]
