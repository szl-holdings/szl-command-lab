# Operational Command lab Space — stdlib Python hologram, no npm.
# GCR pin: HF builders fail public.ecr.aws with exit 128.
FROM mirror.gcr.io/library/python:3.12-slim
WORKDIR /app
ENV HOST=0.0.0.0 PORT=7860 PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
COPY server.py ./server.py
COPY index.html ./index.html
EXPOSE 7860
CMD ["python", "-u", "server.py"]
