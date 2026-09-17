# API do Mais Horas. Usada pelo deploy em servidor próprio (deploy/).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Roda sem root. A pasta de uploads nasce aqui para o volume herdar o dono.
RUN useradd --create-home --uid 1000 app \
    && mkdir -p /dados/uploads \
    && chown -R app:app /dados
USER app

EXPOSE 3000

# Um worker só: o rate limit é em memória, por processo (dívida conhecida).
# As migrations rodam a cada subida; o Alembic não refaz o que já aplicou.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 3000 --proxy-headers --forwarded-allow-ips='*'"]
