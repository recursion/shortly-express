var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

// TODO: localize to user model
// var salt = bcrypt.genSaltSync(10);

var authorize = function(req, res) {
  if (!req.session.user) {
    res.redirect('/login');
  }

  return true;
};

var createSession = function(req, res, username) {
  req.session.regenerate(function(err) {
    if (err) throw err;
    req.session.user = username;
    res.redirect('/');
  });
};

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({
  secret: 'mouserat'
}));

// app.use(function(req, res, next) {
//   console.log(req.session.user);
//   next();
// });

app.get('/',
function(req, res) {
  var authed = authorize(req, res);
  res.render('index', {authed: authed});
});

app.get('/create',
function(req, res) {
  var authed = authorize(req, res);
  res.render('index', {authed: authed});
});

app.get('/links',
function(req, res) {
  var authed = authorize(req, res);
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links',
function(req, res) {
  authorize(req, res);
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/login', function(req, res) {
  res.render('login', {authed: false});
});

app.post('/login', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  // password = hashed(password);

  // Check that user exists and hashed password matches
  // hash user password
    // check user and password against db entry

  new User ({username: username}).fetch().then(function(model) {
    if (model) {
      // retrieve salt
      var salt = model.get('salt');
      // compare hashed password
      bcrypt.hash(password, salt, null, function(err, encrypted) {
        if (err) throw err;

        if (encrypted === model.get('password')) {
          //you're in!
          createSession(req, res, username);
        } else {
          //failcake
          res.redirect('/login');
        }
      });
    } else {
      // failcake
      res.redirect('/login');
    }
  });

});

app.get('/signup', function(req, res) {
  res.render('signup', {authed: false});
});

app.post('/signup', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  new User ({username: username}).fetch().then(function(found) {
    if (found) {
      res.send(400, 'User ' + username +  ' already exists!');
    } else {
      // create user salt
      // attach to user model
      // this may need to be done async eventually
      var salt = bcrypt.genSaltSync(10);
      bcrypt.hash(password, salt, null, function(err, result) {
        var user = new User({
          username: username,
          password: result,
          salt: salt
        });

        user.save().then(function(user) {
          Users.add(user);
          createSession(req, res, username);
        });
      });
    }
  });
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
