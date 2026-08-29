# Operational Command lab Space — stdlib Python, no npm.
# GCR pin: HF builders fail public.ecr.aws with exit 128. Anatomy already runs this FROM.
FROM mirror.gcr.io/library/python:3.12-slim

WORKDIR /app
COPY python ./python
COPY app.py ./
COPY README.md ./
COPY LICENSE ./

ENV HOST=0.0.0.0
ENV PORT=7860
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:7860/healthz', timeout=4)"

CMD ["python", "-u", "app.py"]
