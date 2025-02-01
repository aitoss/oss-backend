const swaggerJSDoc = require('swagger-jsdoc');

const swaggerOptions = {
  swaggerDefinition: {
    info: {
      title: 'Anubhav API',
      version: '1.0.0',
      description: 'Description of your API.',
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
