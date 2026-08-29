# Operational Command lab Space — stdlib Python, no npm.
# Explicit COPY. ECR Public Python so HF builders skip Docker Hub rate limits.
FROM public.ecr.aws/docker/library/python:3.11-slim-bookworm

WORKDIR /app
COPY python ./python
COPY app.py ./
COPY README.md ./
COPY LICENSE ./

ENV HOST=0.0.0.0
ENV PORT=7860
ENV PYTHONUNBUFFERED=1

EXPOSE 7860
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:7860/healthz', timeout=4)"

CMD ["python", "-u", "app.py"]
