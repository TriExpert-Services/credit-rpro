# 🚀 Despliegue en VPS Ubuntu 24 + Cloudflare Tunnel

## Requisitos Previos
- VPS con Ubuntu 24.04 LTS
- Dominio configurado en Cloudflare (triexpertservice.com)
- Cuenta de Cloudflare con Zero Trust habilitado

---

## Paso 1: Preparar el VPS

### Conectar al VPS
```bash
ssh root@tu-ip-del-vps
```

### Actualizar sistema e instalar dependencias
```bash
apt update && apt upgrade -y
apt install -y curl git ufw
```

### Instalar Docker
```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Instalar Docker Compose
apt install -y docker-compose-plugin
```

### Configurar Firewall (solo SSH, Cloudflare maneja el resto)
```bash
ufw allow OpenSSH
ufw enable
```

---

## Paso 2: Instalar Cloudflare Tunnel (cloudflared)

### Instalar cloudflared
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
dpkg -i cloudflared.deb
rm cloudflared.deb
```

### Autenticar con Cloudflare
```bash
cloudflared tunnel login
```
> Esto abrirá un link - cópialo y ábrelo en tu navegador para autorizar.

### Crear el Tunnel
```bash
cloudflared tunnel create triexpert
```
> Guarda el UUID del tunnel que te muestra (ej: `a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### Obtener credenciales
```bash
ls ~/.cloudflared/
# Verás un archivo: a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx.json
```

---

## Paso 3: Clonar el Repositorio

```bash
cd /opt
git clone https://github.com/TriExpert-Services/credit-rpro.git
cd credit-rpro
```

---

## Paso 4: Configurar Variables de Entorno

### Crear archivo .env
```bash
cat > .env << 'EOF'
# Database
POSTGRES_USER=creditrepair
POSTGRES_PASSWORD=TuPasswordSuperSeguro_CambiaEsto_2026!
POSTGRES_DB=creditrepair

# Backend
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://creditrepair:TuPasswordSuperSeguro_CambiaEsto_2026!@postgres:5432/creditrepair
JWT_SECRET=UnSecretoJWTMuyLargoYAleatorio_MinimO64Caracteres_CambiaEsto!
JWT_EXPIRE=7d
FRONTEND_URL=https://triexpertservice.com

# Frontend
VITE_API_URL=https://triexpertservice.com/api

# OpenAI
OPENAI_API_KEY=sk-proj-TU_NUEVA_API_KEY_AQUI
OPENAI_MODEL=gpt-4-turbo
EOF
```

> ⚠️ **IMPORTANTE**: Cambia las contraseñas y secrets por valores seguros y únicos!

---

## Paso 5: Configurar Cloudflare Tunnel

### Crear archivo de configuración del tunnel
```bash
mkdir -p /etc/cloudflared

cat > /etc/cloudflared/config.yml << 'EOF'
tunnel: REEMPLAZA_CON_TU_TUNNEL_UUID
credentials-file: /root/.cloudflared/REEMPLAZA_CON_TU_TUNNEL_UUID.json

ingress:
  # API Backend
  - hostname: triexpertservice.com
    path: /api/*
    service: http://localhost:5000
  
  # Health check
  - hostname: triexpertservice.com
    path: /health
    service: http://localhost:5000
  
  # Uploads
  - hostname: triexpertservice.com
    path: /uploads/*
    service: http://localhost:5000
  
  # Frontend (todo lo demás)
  - hostname: triexpertservice.com
    service: http://localhost:3000
  
  # Catch-all
  - service: http_status:404
EOF
```

> Reemplaza `REEMPLAZA_CON_TU_TUNNEL_UUID` con tu UUID real del tunnel.

### Configurar DNS en Cloudflare
```bash
cloudflared tunnel route dns triexpert triexpertservice.com
```

### Instalar como servicio del sistema
```bash
cloudflared service install
systemctl enable cloudflared
systemctl start cloudflared
```

---

## Paso 6: Modificar Docker Compose para VPS

El docker-compose.yml actual usa nginx como proxy, pero con Cloudflare Tunnel no lo necesitamos. Vamos a simplificarlo:

```bash
cat > docker-compose.prod.yml << 'EOF'
services:
  postgres:
    image: postgres:15-alpine
    container_name: credit-repair-db
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - credit-repair-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: credit-repair-backend
    restart: always
    environment:
      NODE_ENV: production
      PORT: 5000
      DATABASE_URL: ${DATABASE_URL}
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRE: ${JWT_EXPIRE}
      FRONTEND_URL: ${FRONTEND_URL}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OPENAI_MODEL: ${OPENAI_MODEL}
    ports:
      - "127.0.0.1:5000:5000"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - credit-repair-network
    volumes:
      - ./backend/uploads:/app/uploads

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_API_URL: ${VITE_API_URL}
    container_name: credit-repair-frontend
    restart: always
    ports:
      - "127.0.0.1:3000:80"
    depends_on:
      - backend
    networks:
      - credit-repair-network

volumes:
  postgres_data:

networks:
  credit-repair-network:
    driver: bridge
EOF
```

---

## Paso 7: Desplegar la Aplicación

### Construir e iniciar
```bash
cd /opt/credit-rpro
docker compose -f docker-compose.prod.yml up -d --build
```

### Verificar que todo está corriendo
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

### Verificar el tunnel
```bash
systemctl status cloudflared
journalctl -u cloudflared -f
```

---

## Paso 8: Verificar el Despliegue

1. Abre https://triexpertservice.com en tu navegador
2. Deberías ver la página de login
3. Prueba iniciar sesión con: `admin@creditrepair.com` / `Admin123!`

---

## 🔧 Comandos Útiles

### Ver logs de la aplicación
```bash
cd /opt/credit-rpro
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
```

### Reiniciar servicios
```bash
docker compose -f docker-compose.prod.yml restart
```

### Actualizar la aplicación (después de hacer git push)
```bash
cd /opt/credit-rpro
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

### Reiniciar Cloudflare Tunnel
```bash
systemctl restart cloudflared
```

### Ver estado del tunnel
```bash
cloudflared tunnel info triexpert
```

### Backup de la base de datos
```bash
docker exec credit-repair-db pg_dump -U creditrepair creditrepair > backup_$(date +%Y%m%d).sql
```

### Restaurar base de datos
```bash
cat backup.sql | docker exec -i credit-repair-db psql -U creditrepair creditrepair
```

---

## 🔒 Seguridad Adicional

### Configurar actualizaciones automáticas
```bash
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades
```

### Instalar fail2ban
```bash
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

### Crear usuario no-root (recomendado)
```bash
adduser deploy
usermod -aG docker deploy
usermod -aG sudo deploy
```

---

## 🐛 Troubleshooting

### Error "Network Error" en el frontend
1. Verifica que el backend esté corriendo: `docker ps`
2. Revisa logs: `docker compose -f docker-compose.prod.yml logs backend`
3. Verifica el tunnel: `systemctl status cloudflared`

### La base de datos no inicia
```bash
docker compose -f docker-compose.prod.yml logs postgres
# Si hay problemas de permisos:
docker volume rm credit-rpro_postgres_data
docker compose -f docker-compose.prod.yml up -d
```

### El tunnel no conecta
```bash
# Verificar credenciales
ls ~/.cloudflared/
# Verificar config
cat /etc/cloudflared/config.yml
# Ver logs detallados
journalctl -u cloudflared --no-pager -n 100
```

---

## 📊 Monitoreo (Opcional)

### Instalar Portainer para gestión visual de Docker
```bash
docker volume create portainer_data
docker run -d -p 127.0.0.1:9000:9000 --name portainer \
    --restart=always \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v portainer_data:/data \
    portainer/portainer-ce:latest
```

Luego agrega una regla en el config del tunnel:
```yaml
  - hostname: portainer.triexpertservice.com
    service: http://localhost:9000
```

---

¡Listo! Tu aplicación debería estar corriendo en https://triexpertservice.com 🎉
