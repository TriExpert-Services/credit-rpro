# Guía de Despliegue Perfecto - Credit Repair SaaS

## ✅ Requisitos Previos Completados

- [x] Docker Desktop instalado con WSL2
- [x] Docker Compose (`docker compose` v2+)
- [x] `.env` configurado en la raíz
- [x] `package-lock.json` en backend y frontend
- [x] Base de datos PostgreSQL con esquema inicializado
- [x] Variables de entorno correctas

## 🚀 Despliegue Local (Desarrollo)

### 1. Clonar y Configurar
```bash
git clone <tu-repo>
cd credit-rpro

# Crear .env (ver .env.example o template abajo)
cp .env.example .env
# O editar manualmente con tus valores
```

### 2. Levantar los Servicios
```bash
# Crear carpeta uploads si no existe
mkdir -p backend/uploads

# Construir y levantar (primera vez)
docker compose up -d --build

# Ver logs en tiempo real
docker compose logs -f

# Ver estado de servicios
docker compose ps
```

### 3. Verificar Salud del Sistema
```bash
# Health check del backend
curl http://localhost:5000/health

# Acceder a la aplicación
# Frontend: http://localhost:3000
# Backend: http://localhost:5000
# Nginx: http://localhost

# Credenciales por defecto:
# Email: admin@creditrepair.com
# Password: Admin123! (⚠️ CAMBIAR INMEDIATAMENTE)
```

## 📋 Archivo `.env` Template

```env
# ======================
# DATABASE
# ======================
POSTGRES_USER=creditrepair
POSTGRES_PASSWORD=TuPasswordSeguro_Min20Chars_Cambiar!
POSTGRES_DB=creditrepair

# ======================
# BACKEND
# ======================
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://creditrepair:TuPasswordSeguro_Min20Chars_Cambiar!@postgres:5432/creditrepair
JWT_SECRET=UnSecretoJWT_MuyLargo_Aleatorio_Min32Chars_Cambiar!
JWT_EXPIRE=7d
FRONTEND_URL=http://localhost:3000

# ======================
# FRONTEND
# ======================
VITE_API_URL=http://localhost:5000/api

# ======================
# OPTIONAL: EMAIL (para futuro)
# ======================
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=tu-email@gmail.com
# SMTP_PASS=tu-app-password
```

## 🔒 Seguridad - Checklist Pre-Producción

### Contraseñas y Secretos
- [ ] `POSTGRES_PASSWORD`: mínimo 20 caracteres, aleatorio
- [ ] `JWT_SECRET`: mínimo 32 caracteres, aleatorio
- [ ] Admin password cambiado desde default `Admin123!`
- [ ] `.env` en `.gitignore` y NUNCA comitear

### Certificados SSL/HTTPS
- [ ] Dominio apuntando a tu servidor
- [ ] Let's Encrypt habilitado (si usas Coolify)
- [ ] HTTPS forzado en Nginx
- [ ] Headers de seguridad configurados

### Base de Datos
- [ ] Backups automáticos habilitados
- [ ] Réplicas o failover configuradas (producción)
- [ ] Credenciales de DB seguras
- [ ] Acceso a DB restringido solo a backend

### Aplicación
- [ ] Rate limiting activo (Nginx + Backend)
- [ ] CORS configurado correctamente
- [ ] Health checks monitoreados
- [ ] Logs centralizados
- [ ] Monitoreo de errores (Sentry, DataDog, etc.)

## 🛠️ Comandos Útiles

```bash
# Ver logs de un servicio específico
docker compose logs -f backend
docker compose logs -f postgres
docker compose logs -f frontend

# Acceder a la BD
docker compose exec postgres psql -U creditrepair -d creditrepair

# Parar sin borrar datos
docker compose stop

# Restart de servicios
docker compose restart backend

# Limpiar volúmenes (⚠️ BORRA DATOS)
docker compose down -v

# Ver variables de entorno del contenedor
docker compose exec backend env
```

## 🚀 Despliegue en Producción (Coolify o Servidor)

Ver [COOLIFY_DEPLOYMENT.md](COOLIFY_DEPLOYMENT.md) para instrucciones detalladas.

### Pasos Rápidos:
1. Subir repo a GitHub/GitLab con `.gitignore`
2. En Coolify: New Resource → Docker Compose
3. Conectar repositorio y rama (`main`)
4. Configurar variables de entorno
5. Configurar dominio (Coolify maneja SSL automático)
6. Deploy!

## 📊 Stack Tecnológico

| Componente | Tecnología | Versión |
|-----------|-----------|---------|
| Backend | Node.js + Express | 18-alpine |
| Frontend | React + Vite | Latest |
| Base Datos | PostgreSQL | 15-alpine |
| Reverse Proxy | Nginx | alpine |
| Orquestación | Docker Compose | v2+ |
| Deployment | Coolify (opcional) | Latest |

## 🔍 Troubleshooting

### "Database does not exist"
✅ **SOLUCIONADO**: El `init.sql` ahora crea la BD automáticamente

### Backend no se conecta a DB
- Verificar `DATABASE_URL` en `.env`
- Esperar a que PostgreSQL esté `healthy` (ver `docker compose ps`)
- Revisar logs: `docker compose logs postgres`

### Puerto ya en uso
```bash
# Encontrar qué usa el puerto 5000
lsof -i :5000
# O cambiar puerto en docker-compose.yml
```

### Certificados SSL fallan
- Asegurar que el dominio apunta al servidor IP correcto
- Esperar 5-10 minutos para propagación DNS
- Revisar logs de Nginx: `docker compose logs nginx`

## 📞 Soporte y Recursos

- [Docker Docs](https://docs.docker.com)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Coolify Docs](https://coolify.io/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Express.js Docs](https://expressjs.com/)

---

**Última actualización**: 2026-02-04
**Estado**: ✅ Producción-Ready
