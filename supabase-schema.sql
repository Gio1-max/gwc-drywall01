-- ============================================
-- GWC DRYWALL CONSTRUCTION LTD
-- Schema de base de datos para Supabase
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Tabla de perfiles de usuario (extiende auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  email TEXT NOT NULL,
  email_etransfer TEXT,
  role TEXT NOT NULL DEFAULT 'empleado' CHECK (role IN ('admin', 'empleado')),
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de proyectos / casas
CREATE TABLE IF NOT EXISTS proyectos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL,
  cliente TEXT,
  total_sf DECIMAL(10,2),
  tarifa_sf DECIMAL(5,4) DEFAULT 0.28,
  ingreso_total DECIMAL(10,2) GENERATED ALWAYS AS (total_sf * tarifa_sf) STORED,
  fecha_inicio DATE,
  fecha_fin_estimada DATE,
  activo BOOLEAN DEFAULT TRUE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de registros de horas
CREATE TABLE IF NOT EXISTS registros_horas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  empleado_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE CASCADE NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  total_horas DECIMAL(5,2) NOT NULL,
  estado TEXT DEFAULT 'aprobado' CHECK (estado IN ('aprobado', 'pendiente', 'rechazado')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de gastos por proyecto (materiales y suministros)
CREATE TABLE IF NOT EXISTS gastos_proyecto (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE CASCADE NOT NULL,
  descripcion TEXT NOT NULL,
  categoria TEXT CHECK (categoria IN ('material', 'herramienta', 'transporte', 'otro')),
  monto DECIMAL(10,2) NOT NULL,
  fecha DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_horas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_proyecto ENABLE ROW LEVEL SECURITY;

-- Profiles: cada quien ve el suyo, admin ve todos
CREATE POLICY "profiles_self" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Proyectos: todos ven los activos, solo admin modifica
CREATE POLICY "proyectos_read_all" ON proyectos
  FOR SELECT USING (TRUE);

CREATE POLICY "proyectos_admin_write" ON proyectos
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Registros de horas: empleado ve y crea los suyos, admin ve todos
CREATE POLICY "horas_empleado_own" ON registros_horas
  FOR SELECT USING (empleado_id = auth.uid());

CREATE POLICY "horas_empleado_insert" ON registros_horas
  FOR INSERT WITH CHECK (empleado_id = auth.uid());

CREATE POLICY "horas_admin_all" ON registros_horas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Gastos: solo admin
CREATE POLICY "gastos_admin_all" ON gastos_proyecto
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- TRIGGER: crear perfil automáticamente al registrar usuario
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, apellido, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'empleado')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- DATOS INICIALES: crear usuario administrador
-- (Esto se hace desde el dashboard de Supabase)
-- Authentication > Users > Add User
-- Email: GIO_YARED@hotmail.com
-- Luego ejecuta esto para hacerlo admin:
-- ============================================
-- UPDATE profiles SET role = 'admin' WHERE email = 'GIO_YARED@hotmail.com';
