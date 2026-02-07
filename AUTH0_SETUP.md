# Configuración de Auth0 con MFA para TriExpert Credit Repair

## 1. Crear cuenta en Auth0

1. Ve a https://auth0.com y crea una cuenta gratuita
2. Selecciona tu región (recomendado: US)

## 2. Crear Aplicación

1. En el Dashboard de Auth0, ve a **Applications** → **Applications**
2. Click en **+ Create Application**
3. Nombre: `TriExpert Credit Repair`
4. Tipo: **Single Page Web Application**
5. Click **Create**

## 3. Configurar Application Settings

En la página de la aplicación:

### Basic Information
- **Name**: TriExpert Credit Repair
- **Domain**: (tu-tenant.us.auth0.com) - Copia este valor

### Application URIs
```
Allowed Callback URLs:
https://triexpertservice.com, http://localhost:3000, http://localhost

Allowed Logout URLs:
https://triexpertservice.com, http://localhost:3000, http://localhost

Allowed Web Origins:
https://triexpertservice.com, http://localhost:3000, http://localhost
```

### Credentials
- Copia **Client ID**
- Copia **Client Secret**

## 4. Crear API

1. Ve a **Applications** → **APIs**
2. Click en **+ Create API**
3. Configuración:
   - **Name**: TriExpert Credit API
   - **Identifier**: `https://triexpertservice.com/api`
   - **Signing Algorithm**: RS256
4. Click **Create**

## 5. Configurar MFA

### Habilitar MFA

1. Ve a **Security** → **Multi-factor Auth**
2. Habilita las opciones que desees:
   - ✅ **One-time Password** (Authenticator apps como Google Auth)
   - ✅ **Push Notifications** (Auth0 Guardian app)
   - ✅ **SMS** (requiere plan pago)
   - ✅ **Email** (código por email)
   - ✅ **WebAuthn with FIDO Security Keys** (llaves físicas)
   - ✅ **WebAuthn Platform Authenticators** (Face ID, Touch ID, Windows Hello)

3. En **Policies**, selecciona:
   - **Require Multi-factor Auth**: `Always`
   - O selecciona `Adaptive` para requerir MFA solo en casos sospechosos

### Configurar Políticas de MFA

1. Ve a **Actions** → **Flows** → **Login**
2. Puedes crear una acción personalizada para forzar MFA:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  // Requerir MFA si el usuario no tiene MFA configurado
  if (!event.authentication.methods.some(m => m.name === 'mfa')) {
    api.multifactor.enable('any');
  }
};
```

## 6. Actualizar Variables de Entorno

Edita el archivo `.env` en tu proyecto:

```env
# Auth0 Configuration (MFA)
AUTH0_DOMAIN=tu-tenant.us.auth0.com
AUTH0_CLIENT_ID=tu_client_id_de_auth0
AUTH0_CLIENT_SECRET=tu_client_secret_de_auth0
AUTH0_AUDIENCE=https://triexpertservice.com/api

# Variables para el Frontend (Vite)
VITE_AUTH0_DOMAIN=tu-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=tu_client_id_de_auth0
VITE_AUTH0_AUDIENCE=https://triexpertservice.com/api
```

## 7. Ejecutar Migración de Base de Datos

Ejecuta la migración para agregar campos de Auth0:

```bash
# Conectar al contenedor de PostgreSQL
docker exec -it credit-repair-db psql -U creditrepair -d creditrepair

# Ejecutar la migración
\i /path/to/migrations/001_add_auth0_support.sql

# O manualmente:
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth0_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'local';
ALTER TABLE users ADD COLUMN IF NOT EXISTS picture TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
```

## 8. Reconstruir y Desplegar

```bash
# Reconstruir contenedores con nuevas variables
docker compose down
docker compose build --no-cache
docker compose up -d

# Verificar logs
docker compose logs -f
```

## 9. Probar MFA

1. Abre https://triexpertservice.com/login
2. Click en **"Iniciar con MFA Seguro"**
3. Serás redirigido a Auth0
4. Crea una cuenta o inicia sesión
5. Auth0 te pedirá configurar MFA (app authenticator, email, etc.)
6. Completa la verificación MFA
7. Serás redirigido de vuelta a la aplicación

## Flujo de Autenticación

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────>│     Auth0       │────>│    Backend      │
│  (React App)    │     │  (MFA + Login)  │     │   (Express)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │  1. Click Login       │                       │
        │─────────────────────> │                       │
        │                       │                       │
        │  2. Redirect Auth0    │                       │
        │ <─────────────────────│                       │
        │                       │                       │
        │  3. Login + MFA       │                       │
        │─────────────────────> │                       │
        │                       │                       │
        │  4. Return Token      │                       │
        │ <─────────────────────│                       │
        │                       │                       │
        │  5. Sync User         │                       │
        │───────────────────────────────────────────────>│
        │                       │                       │
        │  6. Create/Update DB  │                       │
        │ <──────────────────────────────────────────────│
        │                       │                       │
        │  7. Access App        │                       │
        │───────────────────────────────────────────────>│
```

## Troubleshooting

### "Invalid state" error
- Verifica que las URLs de callback estén correctamente configuradas
- Asegúrate de que `window.location.origin` coincida con las URLs permitidas

### Token no válido
- Verifica que AUTH0_AUDIENCE coincida en frontend y backend
- Verifica que el dominio sea correcto

### MFA no aparece
- Verifica que MFA esté habilitado en Auth0 Dashboard
- Verifica las políticas de MFA

### Usuario no se crea en BD
- Verifica los logs del backend: `docker compose logs backend`
- Verifica que el endpoint `/api/auth/auth0/sync` esté funcionando

## Seguridad Adicional

1. **Brute Force Protection**: Auth0 lo incluye por defecto
2. **Bot Detection**: Habilitar en Security → Bot Detection
3. **Breached Password Detection**: Habilitar en Security → Attack Protection
4. **Suspicious IP Throttling**: Habilitar en Security → Attack Protection

## Planes de Auth0

- **Free**: 7,500 MAU (usuarios activos mensuales), MFA básico
- **Essential**: $23/mes - 1,000 MAU, MFA completo
- **Professional**: $240/mes - 10,000 MAU, características avanzadas

Para producción con MFA completo, recomiendo al menos el plan Essential.
