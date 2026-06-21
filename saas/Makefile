.PHONY: dev prod down logs shell-db

dev:
	docker compose up --build

prod:
	docker compose --profile production up -d --build

down:
	docker compose down

logs:
	docker compose logs -f backend

shell-db:
	docker compose exec db psql -U forge -d forge_saas

# Crée le premier atelier (tenant + admin)
# Usage : make setup EMAIL=admin@mon-atelier.fr PASSWORD=secret NOM="Mon Atelier"
setup:
	curl -s -X POST http://localhost:8000/api/tenants/ \
	  -H "Content-Type: application/json" \
	  -d '{"slug":"$(shell echo $(NOM) | tr A-Z a-z | tr ' ' '-')","name":"$(NOM)","admin_email":"$(EMAIL)","admin_password":"$(PASSWORD)","admin_full_name":"Administrateur"}'
