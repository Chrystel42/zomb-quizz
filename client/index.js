$(function () {
  const socket = io();

  socket.on("waiting", () => {
    $(".voirScore").hide();
    $("#welcome").hide();
    $("#gameContainer").hide();
    $("#waiting").show();
    $("#performances").hide();
  });

  socket.on("alreadyConnected", () => {
    $("#loginMessage").text("Vous jouez déjà !!!");
    $("#loginMessage").show();
  });

  socket.on("tooManyPlayers", () => {
    $("#loginMessage").text("Pas plus de deux joueurs en même temps !");
    $("#loginMessage").show();
  });

  socket.on("wrongPassword", () => {
    $("#loginMessage").text("Mot de passe incorrect !");
    $("#loginMessage").show();
  });

  socket.on("start", () => {
    $(".voirScore").hide();
    $("#welcome").hide();
    $("#gameContainer").show();
    $("#waiting").hide();
    $("#performances").hide();
    $("#loginMessage").hide();
  });

  socket.on("question", question => {
    $("#question").text(question.question);
    $("#reponse1").text(question.possibleAnswers[0]);
    $("#reponse2").text(question.possibleAnswers[1]);
    $("#reponse3").text(question.possibleAnswers[2]);
    $("#reponse4").text(question.possibleAnswers[3]);
    $("#welcome").hide();
    $("#gameContainer").show();
    $("#waiting").hide();
    $("#performances").hide();
  });

  socket.on("scores", players => {
    $("#h2Joueur1").text(players.player1.login);
    $("#h2Joueur2").text(players.player2.login);
    $("#scoreNumb1").text(players.player1.score);
    $("#scoreNumb2").text(players.player2.score);
    $("#totalScoreNumb1").text(players.player1.totalScore);
    $("#winLooseNumb1").text(
      `${players.player1.wins}/${players.player1.looses}`
    );
    $("#winLooseNumb2").text(
      `${players.player2.wins}/${players.player2.looses}`
    );
    $("#totalScoreNumb2").text(players.player2.totalScore);
  });

  socket.on("reset", () => {
    $(".reponse").css("border-color", "green");
    $(".reponse").css("background-color", "greenyellow");
    $("#question").text("");
    $("#reponse1").text("");
    $("#reponse2").text("");
    $("#reponse3").text("");
    $("#reponse4").text("");
    $("#minuteurValeur").text("Nouvelle question...");
  });

  socket.on("quit", () => {
    $(".reponse").css("border-color", "green");
    $(".reponse").css("background-color", "greenyellow");
    $("#question").text("");
    $("#reponse1").text("");
    $("#reponse2").text("");
    $("#reponse3").text("");
    $("#reponse4").text("");
    $("#minuteurValeur").text("");
    $(".voirScore").show();
    $("#welcome").show();
    $("#gameContainer").hide();
    $("#waiting").hide();
    $("#performances").hide();
    $("#resultat").hide();
    $("#loginMessage").hide();
  });

  socket.on("answer", (answer, wrong) => {
    if (wrong)
      $(`#reponse${answer + 1}`)
      .parent()
      .css("background-color", "red");
    else
      $(`#reponse${answer + 1}`)
      .parent()
      .css("background-color", "yellow");
  });

  socket.on("timer", timeLeft => {
    $("#minuteurValeur").text(timeLeft);
  });

  function dateDiff(tmp) {
    var diff = {};

    tmp = Math.floor(tmp / 1000); // Nombre de secondes entre les 2 dates
    diff.sec = tmp % 60; // Extraction du nombre de secondes

    tmp = Math.floor((tmp - diff.sec) / 60); // Nombre de minutes (partie entière)
    diff.min = tmp % 60; // Extraction du nombre de minutes

    tmp = Math.floor((tmp - diff.min) / 60); // Nombre d'heures (entières)
    diff.hour = tmp % 24; // Extraction du nombre d'heures

    tmp = Math.floor((tmp - diff.hour) / 24); // Nombre de jours restants
    diff.day = tmp;
    var s = [];
    if (diff.sec !== 0) s = [...s, `${diff.sec} s`];
    if (diff.min !== 0) s = [...s, `${diff.min} min`];
    if (diff.hour !== 0) s = [...s, `${diff.min} h`];
    if (diff.day !== 0) s = [...s, `${diff.min} jours`];
    return s.join(" ");
  }

  socket.on("getHisto", players => {
    $("#perf-tab-body").html("");
    for (let index = 0; index < players.length; index++) {
      const player = players[index];
      $("#perf-tab-body").append(`
      <tr>
        <td>${player.login}</td>
        <td>${player.totalScore}</td>
        <td>${player.wins}</td>
        <td>${player.looses}</td>
        <td>${dateDiff(player.timeSpentInGame)}</td>
      </tr>`);
    }
    $(".voirScore").hide();
    $("#welcome").hide();
    $("#gameContainer").hide();
    $("#waiting").hide();
    $("#performances").show();
    $("#resultat").hide();
    $("#loginMessage").hide();
  });

  socket.on("result", async result => {
    $(".voirScore").show();
    $("#welcome").hide();
    $("#gameContainer").hide();
    $("#waiting").hide();
    $("#performances").hide();
    $("#resultat-text").text(result);
    $("#resultat").show();
    $("#loginMessage").hide();
  });

  $(".reponse").click(e => {
    e.preventDefault();
    var index = e.currentTarget.children[0].id.replace("reponse", "") - 1;
    socket.emit("answer", index);
    $(".reponse").css("border-color", "green");
    $(e.currentTarget).css("border-color", "cyan");
  });
  $(".voirScore").show();
  $("#welcome").show();
  $("#gameContainer").hide();
  $("#waiting").hide();
  $("#performances").hide();
  $("#resultat").hide();
  $("#loginMessage").hide();

  $("#pseudo").on("submit", e => {
    e.preventDefault();
    socket.emit("login", $("#pseudonyme").val(), $("#pass").val());
  });

  $("#btn-scores").click(e => {
    e.preventDefault();
    socket.emit("getHisto");
  });

  $("#pseudonyme").keyup(e => {
    $("#loginMessage").hide();
  });

  $("#pass").keyup(e => {
    $("#loginMessage").hide();
  });

  $("#performances").click(e => {
    e.preventDefault();
    $(".voirScore").show();
    $("#welcome").show();
    $("#gameContainer").hide();
    $("#waiting").hide();
    $("#performances").hide();
    $("#resultat").hide();
    $("#loginMessage").hide();
  });

  $("#retry-btn").click(e => {
    e.preventDefault();
    $(".voirScore").show();
    $("#welcome").show();
    $("#gameContainer").hide();
    $("#waiting").hide();
    $("#performances").hide();
    $("#resultat").hide();
    $("#loginMessage").hide();
  });
});