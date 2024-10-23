const express = require('express');
const axios = require('axios');
const app = express();

const routeWrapper = (handler) => {
  return async (req, res) => {
    return handler(req, res, process.env.STORAGE_SERVICE_URL);
  };
};

app.use(express.json());

app.get('/api/item/:id', routeWrapper(async (req, res, storageServiceUrl) => {
  return axios.get(`${storageServiceUrl}/storage/item/${req.params.id}`)
    .then((response) => {
      res.json(response.data);
    })
    .catch((error) => {
      res.status(error.response?.status || 500).json({ message: 'Error fetching item' });
    });
}));

app.post('/api/item', routeWrapper(async (req, res, storageServiceUrl) => {
  return axios.post(`${storageServiceUrl}/storage/item`, req.body)
    .then((response) => {
      res.status(201).json(response.data);
    })
    .catch((error) => {
      res.status(error.response?.status || 500).json({ message: 'Error saving item' });
    });
}));

app.put('/api/item/:id', routeWrapper(async (req, res, storageServiceUrl) => {
  return axios.put(`${storageServiceUrl}/storage/item/${req.params.id}`, req.body)
    .then((response) => {
      res.json(response.data);
    })
    .catch((error) => {
      res.status(error.response?.status || 500).json({ message: 'Error updating item' });
    });
}));

app.delete('/api/item/:id', routeWrapper(async (req, res, storageServiceUrl) => {
  return axios.delete(`${storageServiceUrl}/storage/item/${req.params.id}`)
    .then((response) => {
      res.json(response.data);
    })
    .catch((error) => {
      res.status(error.response?.status || 500).json({ message: 'Error deleting item' });
    });
}));

app.get('/api/items', routeWrapper(async (req, res, storageServiceUrl) => {
  return axios.get(`${storageServiceUrl}/storage/items`)
    .then((response) => {
      res.json(response.data);
    })
    .catch((error) => {
      res.status(error.response?.status || 500).json({ message: 'Error fetching items' });
    });
}));

module.exports = app;
