const express = require("express");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Helper: Parse text blocks to product objects
function parseProducts(rawText) {
  return rawText.split("---").map(block => {
    const lines = block.trim().split("\n").map(l => l.trim());
    const data = {};
    lines.forEach(line => {
      const [key, ...rest] = line.split(":");
      if (!key) return;
      data[key.trim().toLowerCase()] = rest.join(":").trim();
    });
    return data;
  }).filter(p => p.id && p.name && p.price && p.img);
}

// Helper: Create card HTML
function generateCardHTML(product) {
  let img = "";
  try {
    const imgs = JSON.parse(product.img.replace(/'/g, '"'));
    img = imgs[0];
  } catch {
    img = "";
  }

  return `
    <div class="bg-white p-4 rounded-lg shadow hover:shadow-xl transition">
      <img src="${img}" alt="${product.name}" class="w-full h-56 object-cover rounded mb-3" />
      <h3 class="text-xl font-semibold text-pink-700 mb-1">${product.name}</h3>
      <p class="text-gray-600 text-sm mb-2">${product.description?.split(".")[0] || ""}</p>
      <p class="text-lg font-bold text-gray-800">₹${product.price}</p>
      <a href="/product/${product.id}" class="inline-block mt-3 bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700 text-sm">View Details</a>
    </div>
  `;
}

// Route: Load clothes
app.get("/clothes", (req, res) => {
  const filePath = path.join(__dirname, "clothes.txt");
  const templatePath = path.join(__dirname, "public", "clothes.html");

  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error loading clothes data");

    const products = parseProducts(data);
    const cards = products.map(generateCardHTML).join("\n");

    fs.readFile(templatePath, "utf8", (err, html) => {
      if (err) return res.status(500).send("Error loading template");
      res.send(html.replace("{{card}}", cards));
    });
  });
});

// Route: Load jewellery
app.get("/jewellery", (req, res) => {
  const filePath = path.join(__dirname, "jewellery.txt");
  const templatePath = path.join(__dirname, "public", "jewellery.html");

  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) return res.status(500).send("Error loading jewellery data");

    const products = parseProducts(data);
    const cards = products.map(generateCardHTML).join("\n");

    fs.readFile(templatePath, "utf8", (err, html) => {
      if (err) return res.status(500).send("Error loading template");
      res.send(html.replace("{{card}}", cards));
    });
  });
});

// Route: Product details
app.get("/product/:id", (req, res) => {
  const id = req.params.id;
  const allFiles = ["clothes.txt", "jewellery.txt"];
  const templatePath = path.join(__dirname, "public", "product.html");

  fs.readFile(templatePath, "utf8", (err, htmlTemplate) => {
    if (err) return res.status(500).send("Error loading product page");

    let found = false;

    allFiles.forEach((file, index) => {
      const filePath = path.join(__dirname, file);
      const isLast = index === allFiles.length - 1;

      fs.readFile(filePath, "utf8", (err, data) => {
        if (err) return;

        const products = parseProducts(data);
        const product = products.find(p => p.id === id);

        if (product && !found) {
          found = true;
          const imgs = JSON.parse(product.img.replace(/'/g, '"'));
          const imgHTML = imgs.map(src => `<img src="${src}" class="w-full mb-3 rounded-lg shadow" />`).join("");
          const detailHTML = `
            <h1 class="text-3xl font-bold text-pink-700">${product.name}</h1>
            <p class="text-gray-600">${product.description}</p>
            <p class="text-lg font-bold mt-2">Price: ₹${product.price}</p>
            <input type="hidden" id="product-id" value="${product.id}" />
            <input type="hidden" id="product-title" value="${product.name}" />
            <input type="hidden" id="product-price" value="${product.price}" />
          `;

          let page = htmlTemplate
            .replace("{{images}}", imgHTML)
            .replace("{{details}}", detailHTML)
            .replace("{{title}}", product.name)
            .replace("{{price}}", product.price)
            .replace("{{description}}", product.description);

          return res.send(page);
        }

        if (!found && isLast) {
          res.status(404).send("Product not found");
        }
      });
    });
  });
});

// Route: Handle contact form
app.post("/contact", (req, res) => {
  const { name, email, message } = req.body;
  const text = `📩 *New Contact Message*\n\n👤 *Name*: ${name}\n📧 *Email*: ${email}\n📝 *Message*: ${message}`;

  fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "Markdown" })
  })
    .then(response => response.json())
    .then(data => res.json({ success: data.ok }))
    .catch(err => res.status(500).json({ success: false, error: err.message }));
});

// Route: Handle buy form
app.post("/order", (req, res) => {
  const { name, contact, address, product, price } = req.body;
  const text = `🛍️ *New Order*\n\n👤 *Name*: ${name}\n📞 *Contact*: ${contact}\n🏠 *Address*: ${address}\n\n📦 *Product*: ${product}\n💰 *Price*: ₹${price}`;

  fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "Markdown" })
  })
    .then(response => response.json())
    .then(data => res.json({ success: data.ok }))
    .catch(err => res.status(500).json({ success: false, error: err.message }));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
