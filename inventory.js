const fs = require("fs");
const path = require("path");

const dataFilePath = path.join(__dirname, "data.json");

let inventory;

try {
  const fileContents = fs.readFileSync(dataFilePath, "utf8");
  inventory = JSON.parse(fileContents);

  if (!Array.isArray(inventory)) {
    throw new Error("data.json must contain a JSON array of inventory items");
  }
} catch (error) {
  console.error(`Error: Failed to read inventory from data.json. ${error.message}`);
  process.exit(1);
}

function saveInventory() {
  try {
    const jsonText = JSON.stringify(inventory, null, 2);
    fs.writeFileSync(dataFilePath, `${jsonText}\n`, "utf8");
  } catch (error) {
    console.error(`Error: Failed to save inventory to data.json. ${error.message}`);
  }
}

function processOrder(itemID, quantity) {
  let foundItem = null;

  for (const item of inventory) {
    if (item.itemID === itemID) {
      foundItem = item;
      break;
    }
  }

  if (!foundItem) {
    console.error(`Error: No item found with ID ${itemID}`);
    return;
  }

  if (quantity > foundItem.stockCount) {
    console.error(
      `Error: Insufficient stock for ${foundItem.name}. Only ${foundItem.stockCount} left.`
    );
    return;
  }

  foundItem.stockCount -= quantity;
  saveInventory();
  const itemName =
    quantity === 1 || foundItem.name.endsWith("s")
      ? foundItem.name
      : `${foundItem.name}s`;
  console.log(`Processed order for ${quantity} ${itemName}`);
}

function checkLowStock() {
  for (const item of inventory) {
    if (item.stockCount < 5) {
      console.warn(
        `Low stock: ${item.name} (ID ${item.itemID}) has ${item.stockCount} left at ${item.shelfLocation}`
      );
    }
  }
}

processOrder(103, 3);
checkLowStock
