
// 🚫🚫🚫🚫🚫🚫🚫🚫🚫🚫

// 🌐 SERVIDOR WEB (WAKE)

const PORT = process.env.PORT || 3000;

require('http').createServer((req, res) => {
res.end('Bot activo');
}).listen(PORT, () => {
console.log("🌐 web activo");
});

// Bot normal

const { 
  Client, 
  GatewayIntentBits, 
  SlashCommandBuilder, 
  REST, 
  Routes,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
intents: [GatewayIntentBits.Guilds]
});

// 🌿 MongoDB 

const fs = require('fs');
const Review = require('./models/reviews');
const mongoose = require('mongoose');

if (!process.env.MONGO_URI) {
  console.error("❌ Falta MONGO_URI");
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Mongo conectado'))
  .catch(err => console.error(err));

// =====================
// ⚙️ COMANDOS
// =====================

const commands = [
new SlashCommandBuilder()
.setName('reseña')
.setDescription('Agregar una reseña')
.addUserOption(option =>
option.setName('persona').setDescription('Usuario').setRequired(true))
.addIntegerOption(option =>
option.setName('estrellas').setDescription('1 a 5').setRequired(true))
.addStringOption(option =>
option.setName('comentario').setDescription('Tu reseña').setRequired(true)),

new SlashCommandBuilder()
.setName('setembed')
.setDescription('Vincular embed a persona')
.addUserOption(option =>
option.setName('persona').setDescription('Usuario').setRequired(true))
.addStringOption(option =>
option.setName('mensaje_id').setDescription('ID del embed').setRequired(true)),

new SlashCommandBuilder()
.setName('crearperfil')
.setDescription('Crear perfil de una persona')
.addUserOption(option =>
option.setName('persona').setDescription('Usuario').setRequired(true)),

new SlashCommandBuilder()
.setName('info')
.setDescription('Embed')
.addStringOption(option =>
option.setName('nombre')
.setDescription('Archivo')
.setRequired(true))
];

// =====================
// 🚀 REGISTRAR COMANDOS
// =====================

if (process.env.REGISTER_COMMANDS === "true") {
const rest = new REST({ version: '10' }).setToken(TOKEN);

;(async () => {
try {
await rest.put(
Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
{ body: commands }
);
console.log("✅ Comandos registrados");
} catch (error) {
console.error(error);
}
})();
}

// =====================
// 🤖 BOT LISTO
// =====================

client.once('ready', () => {
console.log(`🤖 Bot listo como ${client.user.tag}`);
});

// =====================
// 🧩 EMBED GENERADOR
// =====================

function generarEmbedReseñas(username, promedio, total, listaReseñas) {
return {
description: `# ⋆˚࿔ ┆ Reseñas de ${username}┆

<a:Star:1497749189096898680> Promedio:
> ${promedio}

<:Pergamimo:1497788835495542944> Reseñas totales:
> ${total}

<a:Time:1497788363241947266> Últimas reseñas:
${listaReseñas}`,
color: 16758784,
image: { url: "https://cdn.discordapp.com/attachments/1498040372323024906/1498040507031486474/1000073586.png?ex=69efb671&is=69ee64f1&hm=5d633196a401b97c7429e1bc3c5da5dc553eb0297e03b170e2e374d000e9581c&" }
};
}

// =====================
// 💬 INTERACCIONES
// =====================

client.on('interactionCreate', async interaction => {
if (!interaction.isChatInputCommand()) return;

// =====================
// 📂 INFO
// =====================
if (interaction.commandName === 'info') {
const nombre = interaction.options.getString('nombre');

try {  
  const perfil = JSON.parse(  
    fs.readFileSync(`./Embeds/${nombre}.json`, 'utf8')  
  );  

let components = [];

if (nombre === "integrantes") {

  const boton = new ButtonBuilder()
    .setLabel("Ver integrantes")
    .setStyle(ButtonStyle.Link)
    .setURL("https://discord.com/channels/1112736931160281150/1499278020702371891");

  const row = new ActionRowBuilder().addComponents(boton);

  components.push(row);
}

await interaction.channel.send({  
  embeds: perfil.embeds,
  components
});

} catch (error) {  
  console.error(error);  
  return interaction.reply({ content: "❌", ephemeral: true });  
}

}

// =====================
// 🆕 CREAR PERFIL
// =====================
if (interaction.commandName === 'crearperfil') {
const user = interaction.options.getUser('persona');
const persona = user.id;

let existente = await Review.findOne({ userId: persona });

if (existente) {
  return interaction.reply({ content: "El perfil ya existe", ephemeral: true });
}

const embedData = generarEmbedReseñas(user.username, "0.0", "0", "Sin reseñas aún");

const mensaje = await interaction.channel.send({
  embeds: [embedData],
});

const nuevo = new Review({
  userId: persona,
  embedId: mensaje.id,
  channelId: mensaje.channel.id,
  reviews: []
});

await nuevo.save();

return interaction.reply({ content: `Perfil creado para <@${persona}> ✅`, ephemeral: true });

}

// =====================
// 🧩 SET EMBED
// =====================
if (interaction.commandName === 'setembed') {
  const user = interaction.options.getUser('persona');
  const persona = user.id;
  const mensaje_id = interaction.options.getString('mensaje_id');

  try {
    const canal = interaction.channel;
    const mensaje = await canal.messages.fetch(mensaje_id);

    let perfil = await Review.findOne({ userId: persona });

    if (!perfil) {
      perfil = new Review({
        userId: persona,
        embedId: mensaje.id,
        channelId: mensaje.channel.id,
        reviews: []
      });
    } else {
      perfil.embedId = mensaje.id;
      perfil.channelId = mensaje.channel.id;
    }

    await perfil.save();

    return interaction.reply({
      content: "🔗 Embed vinculado correctamente",
      ephemeral: true
    });

  } catch (error) {
    return interaction.reply({
      content: "❌ No se pudo obtener el mensaje",
      ephemeral: true
    });
  }
}

// =====================
// ⭐ RESEÑA
// =====================
if (interaction.commandName === 'reseña') {

const user = interaction.options.getUser('persona');  
const persona = user.id;  

const estrellas = interaction.options.getInteger('estrellas');  
const comentario = interaction.options.getString('comentario');  

if (estrellas < 1 || estrellas > 5) {  
  return interaction.reply({ content: "Pon entre 1 y 5 estrellas", ephemeral: true });  
}  

// ⭕ MONGO

let perfil = await Review.findOne({ userId: persona });

if (!perfil) {
  return interaction.reply({ content: "No está vinculado", ephemeral: true });
}

// eliminar reseña previa
perfil.reviews = perfil.reviews.filter(r => r.user !== interaction.user.id);

// agregar nueva
perfil.reviews.push({
  user: interaction.user.id,
  name: interaction.user.username,
  estrellas,
  comentario
});

// limitar
perfil.reviews = perfil.reviews.slice(-50);

perfil.markModified('reviews');
// Avisa a Mongoose que el arreglo cambió

await perfil.save();

const reviews = perfil.reviews;

// 🧹 limitar tamaño  

const total = reviews.length;  
const promedio = (reviews.reduce((acc, r) => acc + r.estrellas, 0) / total).toFixed(1);  

const ultimas = reviews.slice(-10).map(r =>  
  `> <a:Star:1497749189096898680> **${r.estrellas} ▸ ${r.name}:** ${r.comentario}`  
).join("\n");  

try {

const canal = await client.channels.fetch(perfil.channelId);

if (!canal || !canal.isTextBased()) {
  throw new Error("Canal inválido");
}

const mensaje = await canal.messages.fetch(perfil.embedId);

const embedActualizado = generarEmbedReseñas(  
    user.username,  
    promedio,  
    total,  
    ultimas || "Sin reseñas"  
  );  

  await mensaje.edit({  
    embeds: [embedActualizado],  
});

  return interaction.reply({ content: "✅", ephemeral: true });

} catch (error) {  
  console.log("🔁 Recreando embed...");  

  const embedNuevo = generarEmbedReseñas(  
    user.username,  
    promedio,  
    total,  
    ultimas || "Sin reseñas"  
  );  

  let canal;

try {
canal = await client.channels.fetch(perfil.channelId);
if (!canal || !canal.isTextBased()) throw new Error();
} catch {
return interaction.reply({ content: "Canal incorrecto", ephemeral: true });
}

const nuevoMensaje = await canal.send({
embeds: [embedNuevo],
});

perfil.embedId = nuevoMensaje.id;
await perfil.save();

return interaction.reply({ content: "✅", ephemeral: true });
}

});

client.login(TOKEN);