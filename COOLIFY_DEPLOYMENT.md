# 🎯 Guía de Despliegue en Coolify

Esta guía te ayudará a desplegar tu SaaS de Reparación de Crédito en Coolify paso a paso.

## 📋 Preparación

### 1. Preparar el Repositorio Git

Primero, necesitas subir este código a un repositorio Git:

```bash
# Inicializar repositorio
cd credit-repair-saas
git init

# Crear .gitignore
cat > .gitignore << EOF
node_modules/
.env
*.log
dist/
build/
.DS_Store
uploads/*
!uploads/.gitkeep
EOF

# Agregar archivos
git add .
git commit -m "Initial commit - Credit Repair SaaS"

# Conectar con tu repositorio remoto (GitHub, GitLab, etc.)
git remote add origin https://github.com/tu-usuario/credit-repair-saas.git
git push -u origin main
```

### 2. Crear .gitkeep para uploads

```bash
mkdir -p backend/uploads
touch backend/uploads/.gitkeep
```

## 🚀 Despliegue en Coolify

### Paso 1: Crear Nuevo Proyecto

1. Accede a tu panel de Coolify
2. Click en **"New Resource"**
3. Selecciona **"Docker Compose"**
4. Elige **"With Git Repository"**

### Paso 2: Configurar el Repositorio

1. Selecciona tu proveedor Git (GitHub, GitLab, etc.)
2. Autoriza a Coolify si es necesario
3. Selecciona el repositorio `credit-repair-saas`
4. Rama: `main` (o la rama que uses)
5. Ruta al docker-compose: `/` (raíz del proyecto)

### Paso 3: Configurar Variables de Entorno

En el panel de Coolify, agrega estas variables de entorno:

#### Base de Datos
```
POSTGRES_USER=creditrepair
POSTGRES_PASSWORD=tu_password_super_seguro_aqui_min_20_caracteres
POSTGRES_DB=creditrepair_db
```

#### Backend
```
NODE_ENV=production
PORT=5000
JWT_SECRET=tu_secreto_jwt_muy_largo_y_aleatorio_minimo_32_caracteres_cambiar
JWT_EXPIRE=7d
```

#### Frontend
```
VITE_API_URL=https://tudominio.com/api
FRONTEND_URL=https://tudominio.com
```

#### Email (Opcional - para futuro)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password
```

#### Empresa
```
COMPANY_NAME=Tu Empresa de Reparación de Crédito
ADMIN_EMAIL=admin@tuempresa.com
```

### Paso 4: Configurar Dominio

1. En Coolify, ve a la sección **"Domains"**
2. Agrega tu dominio (ejemplo: `creditrepair.tuempresa.com`)
3. Coolify automáticamente:
   - Configurará el reverse proxy
   - Generará certificados SSL con Let's Encrypt
   - Configurará HTTPS automático

### Paso 5: Configurar Persistencia de Datos

Coolify maneja automáticamente los volúmenes Docker definidos en `docker-compose.yml`:
- Base de datos PostgreSQL: persiste automáticamente
- Archivos subidos: persiste en `/app/uploads`

### Paso 6: Desplegar

1. Click en **"Deploy"**
2. Coolify automáticamente:
   - Clona el repositorio
   - Construye las imágenes Docker
   - Inicia los contenedores
   - Configura networking
   - Genera SSL

### Paso 7: Monitorear el Despliegue

1. Ve a la pestaña **"Logs"**
2. Observa el progreso:
   - ✅ Building images...
   - ✅ Starting containers...
   - ✅ PostgreSQL ready
   - ✅ Backend running on port 5000
   - ✅ Frontend built successfully
   - ✅ Nginx proxy configured

### Paso 8: Verificar el Despliegue

1. Accede a tu dominio: `https://tudominio.com`
2. Deberías ver la pantalla de login
3. Prueba las credenciales por defecto:
   - Email: `admin@creditrepair.com`
   - Password: `Admin123!`

## 🔧 Configuración Post-Despliegue

### 1. Cambiar Credenciales de Administrador

**IMPORTANTE**: Inmediatamente después del primer acceso:

```sql
-- Conectarse a la base de datos
docker-compose exec postgres psql -U creditrepair -d creditrepair_db

-- Cambiar el email del admin
UPDATE users SET email = 'tu-email@tuempresa.com' WHERE email = 'admin@creditrepair.com';

-- Para cambiar la contraseña, usa la interfaz web
```

### 2. Configurar Backups

Coolify ofrece backups automáticos. Configúralos:

1. Ve a **"Backups"** en el panel de Coolify
2. Habilita backups automáticos
3. Configura:
   - Frecuencia: Diaria
   - Retención: 30 días
   - Incluir: Base de datos + volúmenes

### 3. Configurar Monitoreo

Coolify incluye monitoreo básico:
- CPU usage
- Memory usage
- Disk usage
- Network traffic

Revisa estos métricas regularmente en el dashboard.

## 🔄 Actualización de la Aplicación

### Método 1: Auto-deployment (Recomendado)

1. En Coolify, habilita **"Auto Deploy"**
2. Cada push a la rama `main` desplegará automáticamente
3. Coolify:
   - Pull del código nuevo
   - Rebuild de imágenes
   - Restart de servicios
   - Zero-downtime deployment

### Método 2: Manual

1. Push tus cambios a Git
2. En Coolify, click en **"Redeploy"**
3. Espera a que termine el proceso

## 🛠️ Solución de Problemas en Coolify

### Problema: La aplicación no inicia

1. Revisa los logs en Coolify
2. Verifica variables de entorno
3. Asegúrate que el puerto 5000 no esté en uso

```bash
# Ver logs de backend
docker-compose logs backend

# Ver logs de base de datos
docker-compose logs postgres
```

### Problema: Error de conexión a base de datos

1. Verifica que `DATABASE_URL` esté correcta
2. Formato: `postgresql://usuario:password@postgres:5432/database`
3. Nota: usar `postgres` como host (nombre del servicio en Docker)

### Problema: SSL/HTTPS no funciona

1. Verifica que tu dominio apunte a tu servidor
2. Espera 5-10 minutos para propagación DNS
3. Coolify regenerará certificados automáticamente
4. Si persiste, regenera manualmente en Coolify

### Problema: Archivos subidos se pierden

1. Verifica que el volumen esté montado correctamente
2. En `docker-compose.yml`, debe estar:
   ```yaml
   volumes:
     - ./backend/uploads:/app/uploads
   ```

## 📊 Monitoreo y Mantenimiento

### Recursos Recomendados

Para un funcionamiento óptimo:
- **CPU**: 2+ cores
- **RAM**: 4GB+ (recomendado 8GB)
- **Disco**: 20GB+ SSD
- **Ancho de banda**: 100GB+/mes

### Tareas de Mantenimiento

#### Diario
- ✅ Revisar logs de errores
- ✅ Verificar disponibilidad de la app

#### Semanal
- ✅ Revisar métricas de uso
- ✅ Verificar espacio en disco
- ✅ Revisar logs de usuarios

#### Mensual
- ✅ Actualizar dependencias
- ✅ Verificar backups
- ✅ Limpiar logs antiguos
- ✅ Optimizar base de datos

```sql
-- Optimizar PostgreSQL mensualmente
VACUUM ANALYZE;
REINDEX DATABASE creditrepair_db;
```

## 🔐 Seguridad en Producción

### Checklist de Seguridad

- [x] HTTPS habilitado
- [x] Contraseñas fuertes configuradas
- [x] Variables de entorno seguras
- [x] Backups automáticos activados
- [x] Rate limiting configurado
- [x] Firewall configurado
- [ ] Monitoreo de seguridad activo
- [ ] Logs de auditoría revisados

### Configurar Firewall (Opcional)

Si accedes directamente al servidor:

```bash
# Permitir solo puertos necesarios
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw enable
```

## 📞 Soporte

Si encuentras problemas:

1. **Logs de Coolify**: Primera fuente de información
2. **Docker logs**: `docker-compose logs -f`
3. **Base de datos**: `docker-compose exec postgres psql -U creditrepair -d creditrepair_db`
4. **Health check**: Visita `/health` endpoint

## 🎉 ¡Listo!

Tu SaaS de Reparación de Crédito está ahora corriendo en producción con:
- ✅ HTTPS automático
- ✅ Base de datos persistente
- ✅ Backups configurados
- ✅ Zero-downtime deployments
- ✅ Monitoreo incluido

¡Felicidades! 🚀
