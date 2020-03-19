// Import des différents modules
const express = require("express");
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);
const reload = require("reload");
const fs = require("fs");
const bcrypt = require("bcrypt");
const MongoClient = require("mongodb").MongoClient;

// On met à disposition les fichiers statiques.
app.use(express.static("client"));

// On met à disposition la bibliothèque Jquery
app.use("/jquery", express.static(__dirname + "/node_modules/jquery/dist/"));

// Route pricipale, affiche la page pricipale
app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

// Définition de l'adresse de la base de données
const mdpMongo = "bouliboy94"

// Création d'un client pour la base de données
const uri = `mongodb+srv://Chrystel42:${mdpMongo}@zomb-quizz-cuzcs.mongodb.net/test?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true
});

client.connect(async err => {
  if (err) {
    console.log(err);
    return;
  }
  databasesList = await client.db().admin().listDatabases();
  console.log("Databases:");
  databasesList.databases.forEach(db => console.log(` - ${db.name}`));
  client.close();
});

const port = process.env.PORT || 3000;
// Nom de la base de données
const dbName = "quizzombie";


const manchesGagnantes = 10;
let players = {};
let sockets = {};
let questions = [];

// Suppression de la base de données lors du chagement de l'application
const drop = async () => {
  try {
    await client.connect();
    const db = client.db(dbName);
    await db.dropDatabase();
    console.log("Database dropped");
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
};

// Initialisation de la base de données avec les questions à partir d'un fichier json
const initDB = async () => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const questionCollection = db.collection("questions");
    // S'il n'y a de question présentes dans la base de données
    if ((await questionCollection.countDocuments()) === 0) {
      // On récupère les questions à partir du fichier json
      let rawdata = fs.readFileSync("questions.json");
      // On converit le buffer créé à partir de la lecture du fichier json en objet Json
      let questions = JSON.parse(rawdata);
      // On insère la liste des questions en une seule fois.
      await questionCollection.insertMany(questions);
    }
    // On récupère la liste des questions à partir de la base de données
    questions = await questionCollection.find().toArray();
    console.log("questions loaded fron database")
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
};
drop().then(initDB());



// Fonction de récupération d'un joueur depuis la base de données
// S'il n'existe pas, on l'insère dans la base avec des infos par défaut, son login et son mot de passe hashé
const getPlayerFromDB = async (login, pass) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const playerCollection = db.collection("players");
    let user = await playerCollection.findOne({
      login: login
    });
    if (user === null) {
      // Génération d'une clé de cryptage
      var salt = await bcrypt.genSalt(2);
      // Génération du hash du mot de passe
      var hashedPassword = await bcrypt.hash(pass, salt);
      // Insertion en base du joueur
      let result = playerCollection.insertOne({
        login: login,
        score: 0,
        totalScore: 0,
        wins: 0,
        looses: 0,
        passwordHash: hashedPassword,
        timeSpentInGame: 0
      });
      // Récupération du joueur inséré en base de données
      return (await result).ops[0];
    } else {
      // Si l'utilisateur existe déjà dans la base de données, on vérifie que le mot de passe fourni correspond
      // au hash du mot de passe stocké pour ce joueur
      if (await bcrypt.compare(pass, user.passwordHash)) return user;
      // Sinon on renvoie une message pour dire que le mot de passe ne correspond pas
      else return "wrongPassword";
    }
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
};
// Récupération de tous les joueurs depuis la base de données
const getPlayersFromDB = async () => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const playerCollection = db.collection("players");
    let users = await playerCollection.find().toArray();
    return users;
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
};

// Sauvegarde d'un joueur en base de données
const savePlayer = async player => {
  try {
    await client.connect();
    // On récupère la base de données
    const db = client.db(dbName);
    // On récupère la collection de joueurs
    const playerCollection = db.collection("players");
    // On remplace le joueur en base de données par celui mis à jour qui est passé dans la méthode
    await playerCollection.replaceOne({
      login: player.login
    }, player);
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
};

// Code s'éxécutant à la connexion physique d'un utilisateur
io.on("connection", async socket => {
  // Connexion logique à l'aide du login et du mot de passe d'un joueur
  socket.on("login", async (login, pass) => {
    if (players[login] !== undefined) {
      // Un joueur avec ce pseudonyme est déjà connecté
      socket.emit("alreadyConnected");
    }
    // Si aucun joueur n'est dans la partie
    else if (Object.keys(players).length === 0) {
      socket.login = login;
      // On récupère ou on insère le joueur en base de données
      let player = await getPlayerFromDB(login, pass);
      // Si le mot de passe ne correspond pas on le communique à la page web
      if (player === "wrongPassword") {
        socket.emit("wrongPassword");
        return;
      }
      // On insère le joueur dans la liste des joueurs de la partie
      players[login] = player;
      // On insère la socket du joueur dans la liste des sockets des joueurs de la partie
      sockets[login] = socket;
      // On met en attente le joueur d'un autre joueur
      socket.emit("waiting");
    }
    // Un autre joueur est déjà présent dans la partie
    else if (Object.keys(players).length === 1) {
      socket.login = login;
      // On récupère ou on insère le joueur en base de données
      let player = await getPlayerFromDB(login, pass);
      // Si le mot de passe ne correspond pas on informe l'utilisateur
      if (player === "wrongPassword") {
        socket.emit("wrongPassword");
        return;
      }
      // On insère le joueur dans la liste des joueurs de la partie
      players[login] = player;
      // On insère la socket du joueur dans la liste des sockets des joueurs de la partie
      sockets[login] = socket;
      // On envoie un message à tous les joueurs que la partie va commencer
      Object.values(sockets).map(s => {
        s.emit("start");
      });
      // On exécute le code de la partie
      runGame();
    }
    // Deux joueurs s'affrontent déjà. Il faut patienter...
    else {
      socket.emit("tooManyPlayers");
    }
  });
  // Un joueur envoie la réponse qu'il a choisi à une question
  socket.on("answer", async answer => {
    // On stocke la réponse séléctionnée par le joueur dans l'objet qui lui est affecté
    players[socket.login].answer = answer;
  });

  // Un utilisateur demande l'historique des joueurs
  socket.on("getHisto", async () => {
    var players = await getPlayersFromDB();
    socket.emit("getHisto", players);
  });

  // Un utilisateur se déconnecte (fermeture de page ou rechargement)
  socket.on("disconnect", () => {
    // S'il n'est pas présent dans la partie, on ne fait rien
    if (Object.values(sockets).find(s => s === socket) === undefined) return;
    // S'il quitte un partie en cours, on le déclare forfait
    if (Object.values(players).length === 2) {
      let disconnectedPlayer = players[socket.login];
      disconnectedPlayer.looses++;
      // On sauvagarde le joueur
      savePlayer(disconnectedPlayer);
      players[disconnectedPlayer.login] = undefined;
      // On parcourt les joueurs restants, le perdant étant défini à undefined précédemment, on ajoute une victoire à l'autre joueur
      Object.values(players).map(player => {
        if (player) {
          player.wins++;
          // On sauvagarde le joueur
          savePlayer(player);
        }
      });
      // On demande à tous les joueurs de la partie de la quitter
      Object.values(sockets).map(s => s.emit("quit"));
    }
    // On réinitialise la partie
    players = {};
    sockets = {};
  });
});

// Code du quizz
const runGame = async () => {
  // On enregistre la date au début de la partie
  const startDate = new Date();
  // Code permettant de générer un nombre aléatoire inférieur à une valeur max
  const randomint = max => {
    return Math.floor(Math.random() * Math.floor(max));
  };
  // Liste des questions déjà posées
  let alreadyAskedQuestions = [];

  const player1 = players[Object.keys(players)[0]];
  const player2 = players[Object.keys(players)[1]];
  player1.score = 0;
  player2.score = 0;

  // On envoit le score à tous les joueurs
  Object.values(sockets).map(s =>
    s.emit("scores", {
      player1: player1,
      player2: player2
    })
  );

  // On attend une seconde...
  await timeout(1000);

  // Tant que deux joueurs sont dans la partie
  while (Object.values(sockets).length === 2) {
    // On réinitialise l'affiche de la question et des réponses
    Object.values(sockets).map(s => s.emit("reset"));
    // On réinitialise les réponses apportées par les joueurs.
    Object.values(players).map(p => (p.answer = undefined));

    // On définit l'index de la prochaine question
    let nextQuestionIndex = randomint(questions.length);
    // Tant que l'index de la prochaine question est déjà dans la liste des questions déjà posées, on recommence
    while (
      alreadyAskedQuestions.find(element => element === nextQuestionIndex) > -1
    ) {
      nextQuestionIndex = randomint(questions.length);
    }
    // On insère l'index de la question posées dans la liste des questions déjà posées
    alreadyAskedQuestions = [...alreadyAskedQuestions, nextQuestionIndex];

    // On envoit la question et ses réponses possibles aux joueurs
    Object.values(sockets).map(s =>
      s.emit("question", {
        question: questions[nextQuestionIndex].question,
        possibleAnswers: questions[nextQuestionIndex].possibleAnswers
      })
    );
    // Défilement des 5 secondes avec un envoi du temps restant à chaque tour de boucle
    let secondesRestantes = 5;
    do {
      Object.values(sockets).map(s => s.emit("timer", secondesRestantes));
      await timeout(1000);
      secondesRestantes--;
    } while (secondesRestantes >= 0);

    // Si un joueur a trouvé la bonne réponse, on lui accorde le point
    // On envoit le résultat de la manche aux joueurs
    if (player1.answer === questions[nextQuestionIndex].answer) {
      player1.score++;
      player1.totalScore++;
      sockets[player1.login].emit("timer", "Bonne réponse");
    } else {
      sockets[player1.login].emit("timer", "Mauvaise réponse");
    }

    if (player2.answer === questions[nextQuestionIndex].answer) {
      player2.score++;
      player2.totalScore++;
      sockets[player2.login].emit("timer", "Bonne réponse");
    } else {
      sockets[player2.login].emit("timer", "Mauvaise réponse");
    }

    // On envoit la bonne réponse aux joueurs pour l'afficher
    Object.values(sockets).map(s =>
      s.emit(
        "answer",
        questions[nextQuestionIndex].answer,
        // booléen pour définir si la réponse est bonne (couleur de la réponse)
        players[s.login].answer !== questions[nextQuestionIndex].answer
      )
    );
    // On envoit les scores aux joueurs
    Object.values(sockets).map(s =>
      s.emit("scores", {
        player1: player1,
        player2: player2
      })
    );
    // On attend 2 secondes
    await timeout(2000);

    // Si toutes les questions ont été posées, on réinitialise le tableau des questions déjà posées pour continuer le jeu
    if (alreadyAskedQuestions.length === questions.length) {
      alreadyAskedQuestions = [];
    }
    // On détermine si un joueur a gagné
    if (player1.score > player2.score && player1.score >= manchesGagnantes) {
      player1.wins++;
      player2.looses++;
      sockets[player1.login].emit("result", "Bravo, vous avez gagné !");
      sockets[player2.login].emit("result", "Dommage, vous avez perdu !");
      // On calcule le temps passé
      var diff = new Date() - startDate;
      player1.timeSpentInGame += diff;
      player2.timeSpentInGame += diff;
      await savePlayer(player1);
      await savePlayer(player2);
      // Si un joueur a gagné on sort de la boucle
      break;
    } else if (
      player1.score < player2.score &&
      player2.score >= manchesGagnantes
    ) {
      player2.wins++;
      player1.looses++;
      sockets[player2.login].emit("result", "Bravo, vous avez gagné !");
      sockets[player1.login].emit("result", "Dommage, vous avez perdu !");
      // On calcule le temps passé
      var diff = new Date() - startDate;
      player1.timeSpentInGame += diff;
      player2.timeSpentInGame += diff;
      await savePlayer(player1);
      await savePlayer(player2);
      // Si un joueur a gagné on sort de la boucle
      break;
    }
    // Sinon on continue le jeur mais avant on sauvegarde les joueurs en base de données
  }
  // On attend 3 secondes avant de quitter la partie
  await timeout(3000);
  Object.values(sockets).map(s => s.emit("quit"));
  // Réinitialisation de la partie
  players = {};
  sockets = {};
};

// Fonction permettant de renvoyer une promesse à partir d'un timeout
function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Sur chaque changement du code on relance le serveur à l'aide du module reload
reload(app)
  .then(function () {
    // On lance l'écoute sur le port 3000
    http.listen(port, function () {
      console.log(`listening on *:${port}`);
    });
  })
  .catch(function (err) {
    console.error("Reload could not start, could not start server app", err);
  });