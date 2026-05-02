if (process.env.BOT_OFF === "false") {
  process.exit(0);
}

// 🌐 SERVIDOR WEB (WAKE)

const PORT = process.env.PORT || 3000;

require('http').createServer((req, res) => {
  res.end('Bot activo');
}).listen(PORT, () => {
  console.log("🌐 web activo");
});

// =====================
// 🤖 DISCORD
// =====================

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

const mongoose = require('mongoose');
const Review = require('./models/Review');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// =====================
// 🌿 MONGODB
// =====================

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('🟢 Mongo conectado'))
  .catch(err => console.error('❌ Mongo error:', err));

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

  (async () => {
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
// 🤖 READY
// =====================

client.once('ready', () => {
  console.log(`🤖 Bot listo como ${client.user.tag}`);
});

// =====================
// 🧩 EMBED
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
    image: { url: "https://cdn.discordapp.com/attachments/1498040372323024906/1498040507031486474/1000073586.png" }
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
    const fs = require('fs');
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

        components.push(new ActionRowBuilder().addComponents(boton));
      }

      await interaction.channel.send({
        embeds: perfil.embeds,
        components
      });

    } catch {
      return interaction.reply({ content: "❌", ephemeral: true });
    }
  }

  // =====================
  // 🆕 CREAR PERFIL
  // =====================
  if (interaction.commandName === 'crearperfil') {
    const user = interaction.options.getUser('persona');

    let existente = await Review.findOne({ userId: user.id });

    if (existente) {
      return interaction.reply({ content: "El perfil ya existe", ephemeral: true });
    }

    const embed = generarEmbedReseñas(user.username, "0.0", "0", "Sin reseñas aún");

    const mensaje = await interaction.channel.send({
      embeds: [embed],
    });

    await Review.create({
      userId: user.id,
      embedId: mensaje.id,
      channelId: mensaje.channel.id,
      reviews: []
    });

    return interaction.reply({ content: `Perfil creado para <@${user.id}> ✅`, ephemeral: true });
  }

  // =====================
  // 🧩 SET EMBED
  // =====================
  if (interaction.commandName === 'setembed') {
    const user = interaction.options.getUser('persona');
    const mensaje_id = interaction.options.getString('mensaje_id');

    try {
      const mensaje = await interaction.channel.messages.fetch(mensaje_id);

      let perfil = await Review.findOne({ userId: user.id });

      if (!perfil) {
        perfil = new Review({
          userId: user.id,
          embedId: mensaje.id,
          channelId: mensaje.channel.id,
          reviews: []
        });
      } else {
        perfil.embedId = mensaje.id;
        perfil.channelId = mensaje.channel.id;
      }

      await perfil.save();

      return interaction.reply({ content: "🔗 Vinculado", ephemeral: true });

    } catch {
      return interaction.reply({ content: "❌", ephemeral: true });
    }
  }

  // =====================
  // ⭐ RESEÑA
  // =====================
  if (interaction.commandName === 'reseña') {
    const user = interaction.options.getUser('persona');
    const estrellas = interaction.options.getInteger('estrellas');
    const comentario = interaction.options.getString('comentario');

    if (estrellas < 1 || estrellas > 5) {
      return interaction.reply({ content: "Pon entre 1 y 5 estrellas", ephemeral: true });
    }

    let perfil = await Review.findOne({ userId: user.id });

    if (!perfil) {
      return interaction.reply({ content: "No está vinculado", ephemeral: true });
    }

    perfil.reviews = perfil.reviews.filter(r => r.user !== interaction.user.id);

    perfil.reviews.push({
      user: interaction.user.id,
      name: interaction.user.username,
      estrellas,
      comentario
    });

    perfil.reviews = perfil.reviews.slice(-50);

    await perfil.save();

    const reviews = perfil.reviews;
    const total = reviews.length;

    const promedio = total > 0
      ? (reviews.reduce((acc, r) => acc + r.estrellas, 0) / total).toFixed(1)
      : "0.0";

    const ultimas = reviews.slice(-10).map(r =>
      `> ⭐ **${r.estrellas} ▸ ${r.name}:** ${r.comentario}`
    ).join("\n");

    try {
      const canal = await client.channels.fetch(perfil.channelId);
      const mensaje = await canal.messages.fetch(perfil.embedId);

      await mensaje.edit({
        embeds: [generarEmbedReseñas(user.username, promedio, total, ultimas || "Sin reseñas")]
      });

    } catch {
      const canal = await client.channels.fetch(perfil.channelId);

      const nuevo = await canal.send({
        embeds: [generarEmbedReseñas(user.username, promedio, total, ultimas || "Sin reseñas")]
      });

      perfil.embedId = nuevo.id;
      await perfil.save();
    }

    return interaction.reply({ content: "✅", ephemeral: true });
  }
});

client.login(TOKEN);