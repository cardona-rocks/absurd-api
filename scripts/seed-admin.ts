/**
 * Crea (o promueve) la cuenta de administrador por defecto.
 *
 *   ADMIN_EMAIL=tu@correo.com ADMIN_PASSWORD='algo-largo' npm run seed:admin
 *
 * La cuenta queda marcada con `mustChangePassword`, así que el panel obliga a
 * cambiar la contraseña en el primer acceso. Las credenciales nunca se guardan
 * en el repositorio: salen de variables de entorno.
 *
 * Si la cuenta ya existe se limita a darle el rol de admin, sin tocar su
 * contraseña — así el script es seguro de repetir.
 */
import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Admin';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!MONGODB_URI) {
  fail('Falta MONGODB_URI. Copia .env.example a .env y pon tu cadena de conexión.');
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  fail(
    'Faltan ADMIN_EMAIL y/o ADMIN_PASSWORD.\n' +
      "Ejemplo: ADMIN_EMAIL=admin@absurd.com ADMIN_PASSWORD='cambia-esto-ya' npm run seed:admin",
  );
}
if (ADMIN_PASSWORD.length < 10) {
  fail('ADMIN_PASSWORD debe tener al menos 10 caracteres.');
}

// Esquema mínimo: solo lo que este script necesita tocar.
const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, lowercase: true },
    password: String,
    role: { type: String, default: 'player' },
    mustChangePassword: { type: Boolean, default: false },
    credits: { type: Number, default: 600 },
    banned: { type: Boolean, default: false },
    isGuest: { type: Boolean, default: false },
  },
  { timestamps: true, strict: false },
);

const User = mongoose.model('User', UserSchema);

async function run() {
  await mongoose.connect(MONGODB_URI!);
  console.log('Conectado a MongoDB.');

  const email = ADMIN_EMAIL!.toLowerCase();
  const existing = await User.findOne({ email }).exec();

  if (existing) {
    if (existing.get('role') === 'admin') {
      console.log(`"${email}" ya era administrador. Sin cambios.`);
    } else {
      existing.set('role', 'admin');
      existing.set('banned', false);
      await existing.save();
      console.log(`"${email}" ha sido promovido a administrador.`);
    }
    console.log('La contraseña existente no se ha tocado.');
  } else {
    await User.create({
      name: ADMIN_NAME,
      email,
      password: await bcrypt.hash(ADMIN_PASSWORD!, 10),
      role: 'admin',
      mustChangePassword: true,
      credits: 0,
    });
    console.log(`Administrador creado: ${email}`);
    console.log('Tendrá que cambiar la contraseña en el primer acceso.');
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('El seed de administrador falló:', err);
  process.exit(1);
});
