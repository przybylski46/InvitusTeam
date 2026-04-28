// 🌐 SERVIDOR WEB (wake)
const PORT = process.env.PORT || 3000;

require('http').createServer((req, res) => {
  res.end('Bot activo');
}).listen(PORT, () => {
  console.log("🌐 web activo");
});

// 🤖 BOT
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');

// ⚠️ IMPORTANTE (Node 18+ ya lo tiene, pero por si acaso)
const fetch = global.fetch || require("node-fetch");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// 🧠 CACHE ROBLOX
const robloxCache = new Map();
const CACHE_TIME = 10 * 60 * 1000;

async function getRobloxAvatar(userId) {

  const cached = robloxCache.get(userId);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TIME) {
    return cached.url;
  }

  try {
    const url = `https://thumbnails.roblox.com/v1/users/avatar-fullbody?userIds=${userId}&size=420x420&format=Png&isCircular=false`;

    const res = await fetch(url);
    const data = await res.json();

    const avatarUrl = data?.data?.[0]?.imageUrl;

    if (avatarUrl) {
      robloxCache.set(userId, {
        url: avatarUrl,
        timestamp: Date.now()
      });
    }

    return avatarUrl || null;

  } catch (err) {
    console.log("❌ Roblox error:", err);
    return null;
  }
}

// 📦 BASE DE DATOS
function loadData() {
  try {
    return JSON.parse(fs.readFileSync('reviews.json', 'utf8'));
  } catch {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync('reviews.json', JSON.stringify(data, null, 2));
}

let data = loadData();

// ⏱️ GUARDADO DIFERIDO
let saveTimeout;
function saveLater() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveData(data);
    console.log("💾 Guardado");
  }, 5000);
}

// ⚙️ COMANDOS
const commands = [
  new SlashCommandBuilder()
    .setName('reseña')
    .setDescription('Agregar una reseña')
    .addUserOption(o => o.setName('persona').setRequired(true))
    .addIntegerOption(o => o.setName('estrellas').setRequired(true))
    .addStringOption(o => o.setName('comentario').setRequired(true)),

  new SlashCommandBuilder()
    .setName('crearperfil')
    .setDescription('Crear perfil de reseñas')
    .addUserOption(o => o.setName('persona').setRequired(true)),

  new SlashCommandBuilder()
    .setName('info')
    .setDescription('Enviar perfil desde JSON')
    .addStringOption(o => o.setName('nombre').setRequired(true)),

  new SlashCommandBuilder()
    .setName('actualizaravatar')
    .setDescription('Actualizar avatar Roblox')
    .addStringOption(o => o.setName('nombre').setRequired(true))
];

// 🚀 REGISTRAR
if (process.env.REGISTER_COMMANDS === "true") {
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  (async () => {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✅ Comandos registrados");
  })();
}

// 🤖 READY
client.once('ready', () => {
  console.log(`🤖 Bot listo como ${client.user.tag}`);
});

// 🧩 EMBED RESEÑAS
function generarEmbedReseñas(username, promedio, total, lista) {
  return {
    description: `# Reseñas de ${username}\n\nPromedio: ${promedio}\nTotal: ${total}\n\n${lista}`,
    color: 16758784
  };
}

// 💬 INTERACCIONES
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // 📂 INFO
  if (interaction.commandName === 'info') {
    const nombre = interaction.options.getString('nombre');

    try {
      const perfil = JSON.parse(
        fs.readFileSync(`./Embeds/${nombre}.json`, 'utf8')
      );

      const mensaje = await interaction.channel.send({
        embeds: perfil.embeds
      });

      // 🔥 guardar en memoria
      data[nombre] = {
        perfil: {
          robloxId: perfil.robloxId,
          embeds: perfil.embeds,
          channelId: mensaje.channel.id,
          messageId: mensaje.id
        }
      };

      saveLater();

      return interaction.reply({
        content: "✅ Perfil enviado",
        ephemeral: true
      });

    } catch (err) {
      console.log(err);
      return interaction.reply({ content: "❌ Error", ephemeral: true });
    }
  }

  // 🔄 ACTUALIZAR AVATAR
  if (interaction.commandName === 'actualizaravatar') {
    const nombre = interaction.options.getString('nombre');

    try {
      const perfil = data[nombre]?.perfil;

      if (!perfil) {
        return interaction.reply({ content: "❌ No existe perfil", ephemeral: true });
      }

      const canal = await client.channels.fetch(perfil.channelId);
      const mensaje = await canal.messages.fetch(perfil.messageId);

      const avatar = await getRobloxAvatar(perfil.robloxId);

      if (!avatar) {
        return interaction.reply({ content: "❌ No avatar", ephemeral: true });
      }

      if (!perfil.embeds[1]) {
        return interaction.reply({ content: "❌ Falta embed 2", ephemeral: true });
      }

      perfil.embeds[1].image = { url: avatar };

      await mensaje.edit({
        embeds: perfil.embeds
      });

      saveLater();

      return interaction.reply({ content: "✅ Actualizado", ephemeral: true });

    } catch (err) {
      console.log(err);
      return interaction.reply({ content: "❌ Error", ephemeral: true });
    }
  }

  // 🆕 CREAR PERFIL (reseñas)
  if (interaction.commandName === 'crearperfil') {
    const user = interaction.options.getUser('persona');

    if (data[user.id]) {
      return interaction.reply({ content: "Ya existe", ephemeral: true });
    }

    const embed = generarEmbedReseñas(user.username, "0.0", "0", "Sin reseñas");

    const mensaje = await interaction.channel.send({
      embeds: [embed]
    });

    data[user.id] = {
      reviews: [],
      embedId: mensaje.id,
      channelId: mensaje.channel.id
    };

    saveLater();

    return interaction.reply({ content: "Perfil creado", ephemeral: true });
  }

  // ⭐ RESEÑA
  if (interaction.commandName === 'reseña') {
    const user = interaction.options.getUser('persona');
    const persona = user.id;

    if (!data[persona]) {
      return interaction.reply({ content: "No existe perfil", ephemeral: true });
    }

    const estrellas = interaction.options.getInteger('estrellas');
    const comentario = interaction.options.getString('comentario');

    data[persona].reviews.push({
      user: interaction.user.username,
      estrellas,
      comentario
    });

    const reviews = data[persona].reviews;
    const total = reviews.length;
    const promedio = (reviews.reduce((a, r) => a + r.estrellas, 0) / total).toFixed(1);

    const texto = reviews.map(r => `⭐ ${r.estrellas} ${r.user}: ${r.comentario}`).join("\n");

    const canal = await client.channels.fetch(data[persona].channelId);
    const mensaje = await canal.messages.fetch(data[persona].embedId);

    const embed = generarEmbedReseñas(user.username, promedio, total, texto);

    await mensaje.edit({ embeds: [embed] });

    saveLater();

    return interaction.reply({ content: "Reseña guardada", ephemeral: true });
  }

});

client.login(TOKEN);