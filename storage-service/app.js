const express = require('express');
const app = express();

app.use(express.json());

const items = [
  { id: 123, name: 'Sample Item', description: 'An example item.' },
  { id: 124, name: 'Another Item', description: 'A second example item.' }
];

app.get('/storage/item/:id', (req, res) => {
  const item = items.find((item) => item.id === parseInt(req.params.id));

  if (item) {
    res.json({
      id: item.id,
      name: item.name,
      description: item.description
    });
  } else {
    res.status(404).json({ message: 'Item not found' });
  }
});

app.post('/storage/item', (req, res) => {
  const newItem = {
    id: items.length + 125,
    ...req.body
  };

  items.push(newItem);
  res.status(201).json({ status: 'success', id: newItem.id });
});

app.put('/storage/item/:id', (req, res) => {
  const itemIndex = items.findIndex((item) => item.id === parseInt(req.params.id));

  if (itemIndex !== -1) {
    items[itemIndex] = {
      ...items[itemIndex],
      ...req.body
    };

    res.json({ status: 'updated' });
  } else {
    res.status(404).json({ message: 'Item not found' });
  }
});

app.delete('/storage/item/:id', (req, res) => {
  const itemIndex = items.findIndex((item) => item.id === parseInt(req.params.id));

  if (itemIndex !== -1) {
    items.splice(itemIndex, 1);
    res.json({ status: 'deleted', id: req.params.id });
  } else {
    res.status(404).json({ message: 'Item not found' });
  }
});

app.get('/storage/items', (req, res) => {
  res.json(items);
});

module.exports = app;
