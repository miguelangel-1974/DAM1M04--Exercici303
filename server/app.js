const express = require('express');
const fs = require('fs');
const path = require('path');
const hbs = require('hbs');
const MySQL = require('./utilsMySQL');

const app = express();
const port = 3000;

// Detectar si estem al Proxmox (si és pm2)
const isProxmox = !!process.env.PM2_HOME;

// Iniciar connexió MySQL
const db = new MySQL();
if (!isProxmox) {
  db.init({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'P@ssw0rd',
    database: 'sakila'
  });
} else {
  db.init({
    host: '127.0.0.1',
    port: 3306,
    user: 'super',
    password: '1234',
    database: 'sakila'
  });
}

// Static files - ONLY ONCE
app.use(express.static('public'))
app.use(express.urlencoded({ extended: true }))

// Disable cache
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// Handlebars
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// Registrar "Helpers .hbs" aquí
hbs.registerHelper('eq', (a, b) => a == b);
hbs.registerHelper('gt', (a, b) => a > b);

// Partials de Handlebars
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

// Route
app.get('/', async (req, res) => {
  try {
    const moviesRows = await db.query(`
      SELECT f.title as nom, f.release_year as any, GROUP_CONCAT(a.first_name, ' ', a.last_name SEPARATOR ', ') as actors
      FROM film f
      JOIN film_actor fa ON f.film_id = fa.film_id
      JOIN actor a ON fa.actor_id = a.actor_id
      GROUP BY f.film_id LIMIT 5`);
    const categoriesRows = await db.query('SELECT name as nom FROM category LIMIT 5');
    
    const moviesJson = db.table_to_json(moviesRows, { 
      nom: 'string', 
      any: 'number', 
      actors: 'string' 
    });
    const categoriesJson = db.table_to_json(categoriesRows, { 
      nom: 'string' 
    });

    const commonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'common.json'), 'utf8')
    );

    const data = {
      movies: moviesJson,
      categories: categoriesJson,
      common: commonData
    };

    res.render('index', data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error consultant la base de dades');
  }
});

app.get('/movies', async (req, res) => {
  try {
    const moviesRows = await db.query(`
      SELECT f.film_id, f.title, f.description, f.release_year, GROUP_CONCAT(a.first_name, ' ', a.last_name SEPARATOR ', ') AS actors
      FROM film f
      LEFT JOIN film_actor fa ON f.film_id = fa.film_id
      LEFT JOIN actor a ON fa.actor_id = a.actor_id
      GROUP BY f.film_id
      LIMIT 15`);

    const moviesJson = db.table_to_json(moviesRows, {
      film_id: 'number',
      title: 'string',
      description: 'string',
      release_year: 'number',
      actors: 'string'
    });

    const commonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'common.json'), 'utf8')
    );

    const data = {
      movies: moviesJson,
      common: commonData
    };

    res.render('movies', data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error consultant la base de dades');
  }
});

app.get('/customers', async (req, res) => {
  try {
    const customerRows = await db.query(`
      SELECT c.first_name, c.last_name, c.email, GROUP_CONCAT(f.title SEPARATOR ' || ') as lloguers
      FROM customer c
      LEFT JOIN rental r ON c.customer_id = r.customer_id
      LEFT JOIN inventory i ON r.inventory_id = i.inventory_id
      LEFT JOIN film f ON i.film_id = f.film_id
      GROUP BY c.customer_id
      LIMIT 25`);

    const customersJson = db.table_to_json(customerRows, {
      first_name: 'string',
      last_name: 'string',
      email: 'string',
      lloguers: 'string'
    });

    const commonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'common.json'), 'utf8')
    );

    const data = {
      customers: customersJson,
      common: commonData
    };

    res.render('customers', data);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error consultant la base de dades');
  }
});

// fitxa d'una pelicula
app.get('/movie', async (req, res) => {
  try {
    const filmId = parseInt(req.query.id, 10)

    const movieRows = await db.query(`
      SELECT f.film_id, f.title, f.description, f.release_year, f.length, f.rating, f.rental_rate, l.name as language,
      GROUP_CONCAT(a.first_name, ' ', a.last_name SEPARATOR ', ') AS actors
      FROM film f
      LEFT JOIN language l ON f.language_id = l.language_id
      LEFT JOIN film_actor fa ON f.film_id = fa.film_id
      LEFT JOIN actor a ON fa.actor_id = a.actor_id
      WHERE f.film_id = ${filmId}
      GROUP BY f.film_id`)

    const movieJson = db.table_to_json(movieRows, {
      film_id: 'number',
      title: 'string',
      description: 'string',
      release_year: 'number',
      length: 'number',
      rating: 'string',
      rental_rate: 'number',
      language: 'string',
      actors: 'string'
    })

    const commonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'common.json'), 'utf8')
    )

    res.render('movie', { movie: movieJson[0], common: commonData })
  } catch (err) {
    console.error(err)
    res.status(500).send('Error consultant la base de dades')
  }
})

// pagina per afegir pelicula
app.get('/movieAdd', async (req, res) => {
  try {
    const languageRows = await db.query('SELECT language_id, name FROM language')
    const languagesJson = db.table_to_json(languageRows, { language_id: 'number', name: 'string' })

    const commonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'common.json'), 'utf8')
    )

    res.render('movieAdd', { languages: languagesJson, common: commonData })
  } catch (err) {
    console.error(err)
    res.status(500).send('Error consultant la base de dades')
  }
})

// pagina per editar pelicula
app.get('/movieEdit', async (req, res) => {
  try {
    const filmId = parseInt(req.query.id, 10)

    const movieRows = await db.query(`
      SELECT film_id, title, description, release_year, length, rating, rental_rate, rental_duration, replacement_cost, language_id
      FROM film
      WHERE film_id = ${filmId}`)

    const movieJson = db.table_to_json(movieRows, {
      film_id: 'number',
      title: 'string',
      description: 'string',
      release_year: 'number',
      length: 'number',
      rating: 'string',
      rental_rate: 'number',
      rental_duration: 'number',
      replacement_cost: 'number',
      language_id: 'number'
    })

    const languageRows = await db.query('SELECT language_id, name FROM language')
    const languagesJson = db.table_to_json(languageRows, { language_id: 'number', name: 'string' })

    const commonData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'common.json'), 'utf8')
    )

    res.render('movieEdit', { movie: movieJson[0], languages: languagesJson, common: commonData })
  } catch (err) {
    console.error(err)
    res.status(500).send('Error consultant la base de dades')
  }
})

// afegir pelicula
app.post('/afegirPeli', async (req, res) => {
  try {
    const title = req.body.title
    const description = req.body.description
    const release_year = req.body.release_year
    const language_id = req.body.language_id

    await db.query(`
      INSERT INTO film (title, description, release_year, language_id, rental_duration, rental_rate, replacement_cost)
      VALUES ("${title}", "${description}", ${release_year}, ${language_id}, 3, 4.99, 19.99)`)

    res.redirect('/movies')
  } catch (err) {
    console.error(err)
    res.status(500).send('Error afegint la pelicula')
  }
})

// editar pelicula
app.post('/editarPeli', async (req, res) => {
  try {
    const film_id = req.body.film_id
    const title = req.body.title
    const description = req.body.description
    const release_year = req.body.release_year
    const language_id = req.body.language_id
    const rating = req.body.rating

    await db.query(`
      UPDATE film SET
        title = "${title}",
        description = "${description}",
        release_year = ${release_year},
        language_id = ${language_id},
        rating = "${rating}"
      WHERE film_id = ${film_id}`)

    res.redirect('/movie?id=' + film_id)
  } catch (err) {
    console.error(err)
    res.status(500).send('Error editant la pelicula')
  }
})

// esborrar pelicula
app.post('/esborrarPeli', async (req, res) => {
  try {
    const film_id = req.body.film_id

    await db.query(`DELETE FROM film WHERE film_id = ${film_id}`)

    res.redirect('/movies')
  } catch (err) {
    console.error(err)
    res.status(500).send('Error esborrant la pelicula')
  }
})

// Start server
const httpServer = app.listen(port, () => {
  console.log(`http://localhost:${port}`);
  console.log(`http://localhost:${port}/movies`);
  console.log(`http://localhost:${port}/customers`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await db.end();
  httpServer.close();
  process.exit(0);
});