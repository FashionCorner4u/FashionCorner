const express = require("express");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// 🔧 Helper: Parse products from text file
function parseProducts(text) {
  return text
    .split("---")
    .map(block => {
      const lines = block.trim().split("\n");
      const data = {};
      lines.forEach(line => {
        const [key, ...rest] = line.split(":");
        if (key && rest.length) {
          data[key.trim().toLowerCase()] = rest.join(":").trim();
        }
      });
      return data;
    })
    .filter(p => p.id && p.name && p.img && p.price);
}

// 🔧 Helper: Generate HTML for a single card
function generateCardHTML(p) {
  let img = "";
  try {
    const imgs = JSON.parse(p.img);
    img = imgs[0] || "";
  } catch (e) {}

  const description = p.description?.split(".")[0] || "";

  return `
    <div class="bg-white p-4 rounded-lg shadow hover:shadow-xl transition">
      <img src="${img}" alt="${p.name}" class="w-full h-56 object-cover rounded mb-3" />
      <h3 class="text-xl font-semibold text-pink-700 mb-1">${p.name}</h3>
      <p class="text-gray-600 text-sm mb-2">${description}</p>
      <p class="text-lg font-bold text-gray-800">₹${p.price}</p>
      <a href="/product/${p.id}" class="inline-block mt-3 bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700 text-sm">Buy</a>
    </div>
  `;
}

// 📄 Dynamic route: clothes
app.get("/clothes", (req, res) => {
  const txtPath = path.join(__dirname, "clothes.txt");
  const htmlPath = path.join(__dirname, "public", "clothes.html");

  fs.readFile(txtPath, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error loading clothes.txt");

    const products = parseProducts(data);
    const cards = products.map(generateCardHTML).join("\n");

    fs.readFile(htmlPath, "utf8", (err, html) => {
      if (err) return res.status(500).send("Error loading clothes.html");
      res.send(html.replace("{{card}}", cards));
    });
  });
});

// 📄 Dynamic route: jewellery
app.get("/jewellery", (req, res) => {
  const txtPath = path.join(__dirname, "jewellery.txt");
  const htmlPath = path.join(__dirname, "public", "jewellery.html");

  fs.readFile(txtPath, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error loading jewellery.txt");

    const products = parseProducts(data);
    const cards = products.map(generateCardHTML).join("\n");

    fs.readFile(htmlPath, "utf8", (err, html) => {
      if (err) return res.status(500).send("Error loading jewellery.html");
      res.send(html.replace("{{card}}", cards));
    });
  });
});

// 📦 Product detail page
app.get("/product/:id", (req, res) => {
  const id = req.params.id;
  const allFiles = ["clothes.txt", "jewellery.txt"];
  const templatePath = path.join(__dirname, "public", "product.html");

  fs.readFile(templatePath, "utf8", (err, template) => {
    if (err) return res.status(500).send("Error loading product page");

    let found = false;

    allFiles.forEach((file, index) => {
      const filePath = path.join(__dirname, file);

      fs.readFile(filePath, "utf8", (err, data) => {
        if (err || found) return;

        const products = parseProducts(data);
        const product = products.find(p => p.id === id);

        if (product) {
          found = true;
          const imgs = JSON.parse(product.img || "[]");
          const imageHtml = imgs.map(src => `<img src="${src}" class="w-full rounded mb-3" />`).join("");

          const filledPage = template
            .replace("{{images}}", imageHtml)
            .replace("{{title}}", product.name)
            .replace("{{description}}", product.description)
            .replace("{{price}}", product.price)
            .replace("{{product}}", product.name);

          res.send(filledPage);
        } else if (index === allFiles.length - 1 && !found) {
          res.status(404).send("Product not found");
        }
      });
    });
  });
});

// 📬 Contact form → Telegram
app.post("/contact", (req, res) => {
  const { name, email, message } = req.body;
  const text = `📩 *New Contact Message*\n\n👤 *Name*: ${name}\n📧 *Email*: ${email}\n📝 *Message*: ${message}`;

  fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "Markdown" })
  })
    .then(r => r.json())
    .then(d => res.json({ success: d.ok }))
    .catch(e => res.status(500).json({ success: false, error: e.message }));
});

// 🛒 Order form → Telegram
app.post("/order", (req, res) => {
  const { name, contact, address, product, price } = req.body;
  const text = `🛍️ *New Order*\n\n👤 *Name*: ${name}\n📞 *Contact*: ${contact}\n🏠 *Address*: ${address}\n\n🧾 *Product*: ${product}\n💰 *Price*: ₹${price}`;

  fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "Markdown" })
  })
    .then(r => r.json())
    .then(d => res.json({ success: d.ok }))
    .catch(e => res.status(500).json({ success: false, error: e.message }));
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`FashionCorner server running on port ${PORT}`);
});
