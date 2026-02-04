#!/bin/bash

# =====================================================
# Script de Despliegue - TriExpert Credit Repair
# Para VPS Ubuntu 24 + Cloudflare Tunnel
# =====================================================

set -e

echo "🚀 Iniciando despliegue de TriExpert Credit Repair..."

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar que estamos en el directorio correcto
if [ ! -f "docker-compose.prod.yml" ]; then
    echo -e "${RED}Error: Ejecuta este script desde el directorio raíz del proyecto${NC}"
    exit 1
fi

# Verificar archivo .env
if [ ! -f ".env" ]; then
    echo -e "${RED}Error: Archivo .env no encontrado${NC}"
    echo "Crea el archivo .env con las variables necesarias"
    exit 1
fi

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Docker no encontrado. Instalando...${NC}"
    curl -fsSL https://get.docker.com | sh
fi

# Verificar si los contenedores están corriendo
echo -e "${YELLOW}Deteniendo contenedores existentes...${NC}"
docker compose -f docker-compose.prod.yml down 2>/dev/null || true

# Construir y levantar
echo -e "${YELLOW}Construyendo imágenes...${NC}"
docker compose -f docker-compose.prod.yml build --no-cache

echo -e "${YELLOW}Iniciando contenedores...${NC}"
docker compose -f docker-compose.prod.yml up -d

# Esperar a que los servicios estén listos
echo -e "${YELLOW}Esperando a que los servicios estén listos...${NC}"
sleep 10

# Verificar estado
echo -e "${GREEN}Estado de los contenedores:${NC}"
docker compose -f docker-compose.prod.yml ps

# Verificar que el backend responde
echo -e "${YELLOW}Verificando backend...${NC}"
for i in {1..30}; do
    if curl -s http://127.0.0.1:5000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend está corriendo${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Backend no responde después de 30 segundos${NC}"
        echo "Revisa los logs: docker compose -f docker-compose.prod.yml logs backend"
        exit 1
    fi
    sleep 1
done

# Verificar que el frontend responde
echo -e "${YELLOW}Verificando frontend...${NC}"
for i in {1..30}; do
    if curl -s http://127.0.0.1:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Frontend está corriendo${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ Frontend no responde después de 30 segundos${NC}"
        echo "Revisa los logs: docker compose -f docker-compose.prod.yml logs frontend"
        exit 1
    fi
    sleep 1
done

# Verificar Cloudflare Tunnel
if systemctl is-active --quiet cloudflared; then
    echo -e "${GREEN}✓ Cloudflare Tunnel está activo${NC}"
else
    echo -e "${YELLOW}⚠ Cloudflare Tunnel no está corriendo${NC}"
    echo "Ejecuta: systemctl start cloudflared"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Despliegue completado exitosamente!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Tu aplicación debería estar disponible en:"
echo -e "${GREEN}https://triexpertservice.com${NC}"
echo ""
echo "Comandos útiles:"
echo "  Ver logs:     docker compose -f docker-compose.prod.yml logs -f"
echo "  Reiniciar:    docker compose -f docker-compose.prod.yml restart"
echo "  Detener:      docker compose -f docker-compose.prod.yml down"
