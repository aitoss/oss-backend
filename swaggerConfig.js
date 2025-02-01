const swaggerJSDoc = require('swagger-jsdoc');

const swaggerOptions = {
  swaggerDefinition: {
    info: {
      title: 'Anubhav API',
      version: '1.0.0',
      description: 'List of all the routes',
    },
    servers: [
      {
        url: 'https://oss-backend.vercel.app/api/',
      },
    ],
  },
  apis: ['./routes/*.js', './routes/**/*.js'],
};

const swaggerDocs = swaggerJSDoc(swaggerOptions);

module.exports = swaggerDocs;
