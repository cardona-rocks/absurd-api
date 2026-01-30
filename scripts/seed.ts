import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb+srv://sandbox:uCkSIQxQk88SfrI6@sandbox.32n4rhw.mongodb.net/absurd?retryWrites=true&w=majority&appName=sandbox';

const weaponSchema = new mongoose.Schema({
  title: String,
  description: String,
  images: [String],
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const weaponsSchema = new mongoose.Schema({
  rock: { type: weaponSchema, default: () => ({}) },
  paper: { type: weaponSchema, default: () => ({}) },
  scissors: { type: weaponSchema, default: () => ({}) },
}, { _id: false });

const attackWeaponSchema = new mongoose.Schema({
  load: String,
  attack: [String],
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const attackSpritesSchema = new mongoose.Schema({
  rock: { type: attackWeaponSchema, default: () => ({}) },
  paper: { type: attackWeaponSchema, default: () => ({}) },
  scissors: { type: attackWeaponSchema, default: () => ({}) },
}, { _id: false });

const baseSpritesSchema = new mongoose.Schema({
  backView: [String],
  frontView: [String],
}, { _id: false });

const damageSpriteSchema = new mongoose.Schema({
  id: String,
  image: String,
  settings: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const spritesSchema = new mongoose.Schema({
  profile: String,
  base: { type: baseSpritesSchema, default: () => ({}) },
  attack: { type: attackSpritesSchema, default: () => ({}) },
  damage: [damageSpriteSchema],
}, { _id: false });

const avatarStatsSchema = new mongoose.Schema({
  wins: { type: Number, default: 0 },
  loses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
}, { _id: false });

const AvatarSchema = new mongoose.Schema({
  name: { type: String, required: true },
  weapons: { type: weaponsSchema, default: () => ({}) },
  sprites: { type: spritesSchema, default: () => ({}) },
  stats: { type: avatarStatsSchema, default: () => ({}) },
  price: { type: Number, default: 0 },
}, { timestamps: true });

const userStatsSchema = new mongoose.Schema({
  wins: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
  loses: { type: Number, default: 0 },
}, { _id: false });

const collectionItemSchema = new mongoose.Schema({
  avatar: { type: mongoose.Schema.Types.ObjectId, ref: 'Avatar', required: true },
  price: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: String,
  credits: { type: Number, default: 10 },
  avatar: { type: mongoose.Schema.Types.ObjectId, ref: 'Avatar', default: null },
  stats: { type: userStatsSchema, default: () => ({}) },
  collection: { type: [collectionItemSchema], default: [] },
  googleId: { type: String, default: null },
  appleId: { type: String, default: null },
}, { timestamps: true, suppressReservedKeysWarning: true });

const Avatar = mongoose.model('Avatar', AvatarSchema);
const User = mongoose.model('User', UserSchema);

const defaultWeapon = (title: string, desc: string) => ({
  title,
  description: desc,
  images: [`https://placehold.co/120x120?text=${encodeURIComponent(title)}`],
  settings: {},
});

const avatarsData = [
  { name: 'Blaze', price: 5, weapons: { rock: defaultWeapon('Molten Fist', 'Rock'), paper: defaultWeapon('Flame Scroll', 'Paper'), scissors: defaultWeapon('Inferno Claws', 'Scissors') }, sprites: { profile: 'https://placehold.co/80x80?text=Blaze', base: { backView: [], frontView: [] }, attack: { rock: {}, paper: {}, scissors: {} }, damage: [] }, stats: { wins: 0, loses: 0, draws: 0 } },
  { name: 'Frost', price: 8, weapons: { rock: defaultWeapon('Ice Boulder', 'Rock'), paper: defaultWeapon('Snowflake', 'Paper'), scissors: defaultWeapon('Crystal Shards', 'Scissors') }, sprites: { profile: 'https://placehold.co/80x80?text=Frost', base: { backView: [], frontView: [] }, attack: { rock: {}, paper: {}, scissors: {} }, damage: [] }, stats: { wins: 0, loses: 0, draws: 0 } },
  { name: 'Shadow', price: 12, weapons: { rock: defaultWeapon('Dark Stone', 'Rock'), paper: defaultWeapon('Veil', 'Paper'), scissors: defaultWeapon('Sickle', 'Scissors') }, sprites: { profile: 'https://placehold.co/80x80?text=Shadow', base: { backView: [], frontView: [] }, attack: { rock: {}, paper: {}, scissors: {} }, damage: [] }, stats: { wins: 0, loses: 0, draws: 0 } },
  { name: 'Titan', price: 15, weapons: { rock: defaultWeapon('Boulder', 'Rock'), paper: defaultWeapon('Shield', 'Paper'), scissors: defaultWeapon('Blade', 'Scissors') }, sprites: { profile: 'https://placehold.co/80x80?text=Titan', base: { backView: [], frontView: [] }, attack: { rock: {}, paper: {}, scissors: {} }, damage: [] }, stats: { wins: 0, loses: 0, draws: 0 } },
];

const usersData = [
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
  { name: 'Carol', email: 'carol@example.com' },
  { name: 'Dave', email: 'dave@example.com' },
  { name: 'Eve', email: 'eve@example.com' },
  { name: 'Frank', email: 'frank@example.com' },
  { name: 'Grace', email: 'grace@example.com' },
  { name: 'Henry', email: 'henry@example.com' },
  { name: 'Ivy', email: 'ivy@example.com' },
  { name: 'Jack', email: 'jack@example.com' },
];

const PASSWORD = 'password123';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const existingAvatars = await Avatar.countDocuments();
  const existingUsers = await User.countDocuments();

  if (existingAvatars > 0 || existingUsers > 0) {
    console.log('Database already has data. Clear collections first if you want to re-seed.');
    console.log('  Avatars:', existingAvatars, '| Users:', existingUsers);
    await mongoose.disconnect();
    return;
  }

  const avatars = await Avatar.insertMany(avatarsData);
  console.log('Created', avatars.length, 'avatars:', avatars.map((a: any) => a.name).join(', '));

  const hashedPassword = await bcrypt.hash(PASSWORD, 10);
  const users: any[] = [];

  for (let i = 0; i < usersData.length; i++) {
    const u = usersData[i];
    const firstAvatar = avatars[0]._id;
    const secondAvatar = avatars[1]._id;
    const credits = 10 + (i % 3) * 5;
    const hasFirst = i < 7;
    const hasSecond = i < 4;
    const collection: { avatar: mongoose.Types.ObjectId; price: number; timestamp: Date }[] = [];
    if (hasFirst) collection.push({ avatar: firstAvatar, price: (avatarsData[0] as any).price, timestamp: new Date() });
    if (hasSecond) collection.push({ avatar: secondAvatar, price: (avatarsData[1] as any).price, timestamp: new Date() });
    const selectedAvatar = hasFirst ? firstAvatar : null;
    users.push({
      name: u.name,
      email: u.email,
      password: hashedPassword,
      credits,
      avatar: selectedAvatar,
      stats: { wins: i % 4, draws: i % 2, loses: i % 3 },
      collection,
    });
  }

  await User.insertMany(users);
  console.log('Created', users.length, 'users. Password for all:', PASSWORD);

  await mongoose.disconnect();
  console.log('Seed done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
