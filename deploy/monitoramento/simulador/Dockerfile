FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN pip install --no-cache-dir httpx==0.28.1 tzdata==2024.2

COPY simulador.py .
RUN useradd --create-home simulador
USER simulador

CMD ["python", "simulador.py"]
