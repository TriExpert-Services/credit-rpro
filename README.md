# 🏆 Credit Repair SaaS - Sistema Profesional de Reparación de Crédito

Sistema completo de gestión para empresas de reparación de crédito, con backend robusto, frontend moderno y listo para desplegar en Coolify.

## 🚀 Características Principales

### Para Clientes
- **Dashboard personalizado** con métricas de progreso
- **Seguimiento de puntaje crediticio** de los 3 bureaus principales
- **Gestión de items negativos** en reportes de crédito
- **Sistema de disputas** con generación automática de cartas
- **Portal de documentos** para subir evidencia y reportes
- **Visualización de progreso** con gráficos y estadísticas

### Para Administradores
- **Dashboard administrativo** con métricas de negocio
- **Gestión de clientes** y suscripciones
- **Panel de control** de disputas y casos
- **Sistema de reportes** y análisis
- **Gestión de pagos** (integración con Stripe)

## 🛠️ Stack Tecnológico

### Backend
- **Node.js + Express** - API REST
- **PostgreSQL** - Base de datos relacional
- **JWT** - Autenticación segura
- **Bcrypt** - Encriptación de contraseñas
- **Multer** - Carga de archivos

### Frontend
- **React 18** - Framework UI
- **Vite** - Build tool moderno y rápido
- **TailwindCSS** - Diseño profesional y responsive
- **React Router** - Navegación SPA
- **Recharts** - Visualización de datos
- **Lucide React** - Iconos modernos

### DevOps
- **Docker & Docker Compose** - Containerización
- **Nginx** - Reverse proxy y load balancing
- **Coolify** - Deployment y hosting

## 📋 Requisitos Previos

- Docker y Docker Compose instalados
- Node.js 18+ (para desarrollo local)
- PostgreSQL 15+ (si usas base de datos externa)
- Coolify instalado en tu homelab

## 🚀 Instalación y Despliegue

### Opción 1: Despliegue con Docker Compose (Desarrollo/Testing)

1. **Clonar el repositorio o usar estos archivos**

2. **Configurar variables de entorno**
```bash
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales:
```env
# Database
POSTGRES_USER=creditrepair
POSTGRES_PASSWORD=tu_password_seguro_aqui
POSTGRES_DB=creditrepair_db

# Backend
JWT_SECRET=tu_secreto_jwt_muy_largo_y_seguro_minimo_32_caracteres
NODE_ENV=production

# Frontend
VITE_API_URL=http://tu-dominio.com/api
```

3. **Construir y ejecutar**
```bash
docker-compose up -d
```

4. **Verificar que todo está corriendo**
```bash
docker-compose ps
docker-compose logs -f
```

5. **Acceder a la aplicación**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Nginx: http://localhost:80

### Opción 2: Despliegue con Coolify (Producción)

1. **Preparar el repositorio Git**
   - Sube todo este código a un repositorio Git (GitHub, GitLab, etc.)

2. **Crear nuevo proyecto en Coolify**
   - Ir a tu panel de Coolify
   - Click en "New Resource" → "Docker Compose"
   - Conectar tu repositorio Git

3. **Configurar variables de entorno en Coolify**
   - En el panel de Coolify, agrega todas las variables del archivo `.env.example`
   - Asegúrate de usar valores seguros para producción

4. **Configurar el dominio**
   - En Coolify, configura tu dominio personalizado
   - Coolify generará automáticamente certificados SSL con Let's Encrypt

5. **Desplegar**
   - Click en "Deploy"
   - Coolify automáticamente:
     - Clonará el repositorio
     - Construirá las imágenes Docker
     - Iniciará los contenedores
     - Configurará HTTPS

6. **Verificar el deployment**
   - Revisa los logs en Coolify
   - Accede a tu dominio y verifica que todo funcione

## 🔐 Usuarios por Defecto

**Administrador:**
- Email: `admin@creditrepair.com`
- Password: `Admin123!`

⚠️ **IMPORTANTE**: Cambia estas credenciales inmediatamente en producción.

## � Configuración de Stripe

Para habilitar pagos y suscripciones, configura Stripe:

1. **Crear cuenta en Stripe** (https://stripe.com)

2. **Obtener claves de API**
   - Ve a Dashboard → Developers → API keys
   - Copia la Publishable key y Secret key

3. **Configurar Webhook**
   - En Stripe Dashboard → Developers → Webhooks
   - Agregar endpoint: `https://tu-dominio.com/api/webhooks/stripe`
   - Seleccionar eventos:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copiar el Webhook signing secret

4. **Variables de entorno**
   ```env
   STRIPE_SECRET_KEY=sk_live_xxx (o sk_test_xxx para pruebas)
   STRIPE_PUBLISHABLE_KEY=pk_live_xxx (o pk_test_xxx para pruebas)
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```

5. **Ejecutar migración de base de datos**
   ```bash
   docker exec -it credit-repair-backend psql -U creditrepair -d creditrepair_db -f /app/migrations/002_stripe_subscriptions.sql
   ```

### Planes de Suscripción
- **Basic** - $99/mes: 3 disputas/mes, soporte email
- **Professional** - $149/mes: 7 disputas/mes, análisis IA, soporte prioritario
- **Premium** - $249/mes: Disputas ilimitadas, análisis completo, soporte 24/7

### Garantía de 90 Días
El sistema incluye una garantía de devolución de dinero si no se ven resultados en 90 días. Los clientes pueden solicitar el reembolso desde su panel y los administradores pueden procesarlo desde la gestión de pagos.

## �📁 Estructura del Proyecto

```
credit-repair-saas/
├── backend/
│   ├── config/           # Configuración de base de datos
│   ├── middleware/       # Middleware de autenticación
│   ├── routes/           # Rutas de la API
│   ├── init.sql          # Schema de base de datos
│   ├── server.js         # Servidor Express
│   ├── package.json      # Dependencias backend
│   └── Dockerfile        # Imagen Docker backend
├── frontend/
│   ├── src/
│   │   ├── components/   # Componentes React
│   │   ├── pages/        # Páginas de la aplicación
│   │   ├── context/      # Context API (Auth)
│   │   ├── services/     # Servicios API
│   │   └── App.jsx       # Componente principal
│   ├── public/           # Archivos estáticos
│   ├── package.json      # Dependencias frontend
│   ├── Dockerfile        # Imagen Docker frontend
│   └── nginx.conf        # Configuración Nginx
├── nginx/
│   └── nginx.conf        # Reverse proxy principal
├── docker-compose.yml    # Orchestración de servicios
├── .env.example          # Variables de entorno ejemplo
└── README.md             # Esta documentación
```

## 🔧 Desarrollo Local

### Backend
```bash
cd backend
npm install
cp ../.env.example .env
# Configurar .env con tu base de datos local
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 📊 Endpoints de la API

### Autenticación
- `POST /api/auth/register` - Registrar nuevo usuario
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/change-password` - Cambiar contraseña

### Usuarios
- `GET /api/users/profile` - Obtener perfil
- `PUT /api/users/profile` - Actualizar perfil
- `GET /api/users` - Listar usuarios (admin)

### Clientes
- `GET /api/clients` - Listar clientes (admin)
- `GET /api/clients/:id` - Obtener cliente

### Puntajes de Crédito
- `GET /api/credit-scores/client/:clientId` - Obtener puntajes
- `POST /api/credit-scores` - Agregar puntaje
- `GET /api/credit-scores/client/:clientId/trends` - Tendencias

### Items de Crédito
- `GET /api/credit-items/client/:clientId` - Listar items
- `POST /api/credit-items` - Agregar item
- `PUT /api/credit-items/:id/status` - Actualizar estado
- `DELETE /api/credit-items/:id` - Eliminar item

### Disputas
- `GET /api/disputes/client/:clientId` - Listar disputas
- `POST /api/disputes` - Crear disputa (genera carta automática)
- `PUT /api/disputes/:id/status` - Actualizar estado
- `GET /api/disputes/:id` - Obtener disputa

### Documentos
- `POST /api/documents/upload` - Subir documento
- `GET /api/documents/client/:clientId` - Listar documentos
- `DELETE /api/documents/:id` - Eliminar documento

### Dashboard
- `GET /api/dashboard/client/:clientId` - Stats de cliente
- `GET /api/dashboard/admin/stats` - Stats de admin

## 🔒 Seguridad

- ✅ Contraseñas hasheadas con bcrypt
- ✅ Autenticación JWT
- ✅ Rate limiting en API
- ✅ Validación de datos con express-validator
- ✅ Headers de seguridad con Helmet
- ✅ CORS configurado
- ✅ Sanitización de inputs
- ✅ HTTPS ready (con Coolify o certificados propios)

## 📈 Próximas Mejoras

- [ ] Integración con Stripe para pagos
- [ ] Sistema de notificaciones por email
- [ ] Exportación de reportes en PDF
- [ ] Chat de soporte en tiempo real
- [ ] Integración con APIs de bureaus de crédito
- [ ] Sistema de recordatorios y tareas
- [ ] App móvil (React Native)
- [ ] Analytics avanzado

## 🐛 Solución de Problemas

### La base de datos no se conecta
```bash
# Verificar que el contenedor de PostgreSQL está corriendo
docker-compose ps postgres

# Ver logs de la base de datos
docker-compose logs postgres

# Reiniciar servicios
docker-compose restart
```

### El frontend no se comunica con el backend
- Verifica que `VITE_API_URL` en `.env` apunte a la URL correcta
- En producción, usa la URL completa con protocolo (https://tudominio.com/api)
- Verifica configuración de CORS en backend

### Error de permisos en archivos
```bash
# Dar permisos a la carpeta de uploads
chmod -R 755 backend/uploads
```

## 📞 Soporte

Para soporte o preguntas:
- Revisa los logs: `docker-compose logs -f`
- Verifica la base de datos: `docker-compose exec postgres psql -U creditrepair -d creditrepair_db`
- Prueba los endpoints: Usa Postman o curl

## 📄 Licencia

Este proyecto es propietario. Todos los derechos reservados.

## 🎉 Créditos

Desarrollado con ❤️ para empresas de reparación de crédito que quieren ofrecer el mejor servicio a sus clientes.

---

**¡Feliz reparación de crédito! 💪💳**
