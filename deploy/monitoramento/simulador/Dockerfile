FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN pip install --no-cache-dir httpx==0.28.1 tzdata==2024.2 fastapi==0.115.6 \
    uvicorn==0.34.0 prometheus-client==0.21.1

COPY simulador.py controle.py ./
RUN useradd --create-home simulador
USER simulador

EXPOSE 8000
CMD ["uvicorn", "controle:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "warning"]
