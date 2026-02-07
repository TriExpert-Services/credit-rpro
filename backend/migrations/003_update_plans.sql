-- Actualizar planes de suscripción optimizados para el mercado
-- 2 planes estratégicos para captar clientes y cubrir costos

-- Eliminar planes anteriores
DELETE FROM subscription_plans;

-- Plan Esencial - $79/mes (competitivo, punto de entrada)
INSERT INTO subscription_plans (
    name, description, price_monthly, price_yearly, features, is_active, 
    trial_days, guarantee_days, max_disputes_per_month, includes_ai_analysis, 
    includes_credit_monitoring, sort_order
) VALUES (
    'Plan Esencial',
    'Ideal para comenzar tu reparación de crédito con resultados comprobados',
    79.00,
    790.00,
    '["Análisis completo de reporte de crédito", "Hasta 5 disputas por mes", "Cartas de disputa personalizadas", "Seguimiento de progreso en tiempo real", "Soporte por email", "Acceso al portal 24/7", "Garantía de devolución de 90 días"]'::jsonb,
    true,
    0,
    90,
    5,
    false,
    false,
    1
);

-- Plan Profesional - $129/mes (premium, mayor margen)
INSERT INTO subscription_plans (
    name, description, price_monthly, price_yearly, features, is_active, 
    trial_days, guarantee_days, max_disputes_per_month, includes_ai_analysis, 
    includes_credit_monitoring, sort_order
) VALUES (
    'Plan Profesional',
    'Máxima dedicación para resultados acelerados y soporte prioritario',
    129.00,
    1290.00,
    '["Todo del Plan Esencial", "Disputas ilimitadas", "Análisis con Inteligencia Artificial", "Cartas de cese y desista incluidas", "Llamada mensual de seguimiento", "Soporte prioritario por chat y teléfono", "Estrategia personalizada de reconstrucción", "Monitoreo de crédito incluido", "Garantía extendida de 90 días"]'::jsonb,
    true,
    0,
    90,
    999,
    true,
    true,
    2
);

-- Verificar
SELECT name, price_monthly, description FROM subscription_plans ORDER BY sort_order;
