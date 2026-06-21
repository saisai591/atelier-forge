FROM python:3.11-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc build-essential python3-dev libpq-dev p7zip-full cabextract unzip \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "core.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
