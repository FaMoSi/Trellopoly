var express = require('express');
var request = require('request');

const EventEmitter = require('events');

class MyEmitter extends EventEmitter {}

const myEmitter = new MyEmitter();
// increase the limit
myEmitter.setMaxListeners(15);

var idStartCard
var idListContrattiScatola
var cardIndex
var idBoardScatola

var router = express.Router();

router.get("/initialize*", function(req, res) {
  var options = {
    method: 'GET',
    url: 'https://api.trello.com/1/members/me' + '/organizations/',
    qs: {
      key: '4dd8f72d0f8b9dfb50ac4131b768ff3d',
      token: req.query.token
    }
  };

  request(options, function(error, response, body) {
    var rsp = {}
    if (error) throw new Error(error);
    var data = JSON.parse(body);
    console.log("========== init =======");
    idBoardScatola = data[0].idBoards[0]
    setIdStardCard(data[0].idBoards[0], req.query.token, function() {
      for (var i = 1; i < data[0].idBoards.length; i++) {
        setPosition(data[0].idBoards[i], i, req.query.token)
      }
    })
  });
});

router.get("/contratti*", function(req, res) {
  var rsp = {}
  var idBoard = req.query.boardId
  var token = req.query.token
  var idList

  var options = {
    method: 'GET',
    url: "https://api.trello.com/1/boards/" + idBoard + "/lists?filter=open",
    qs: {
      key: '4dd8f72d0f8b9dfb50ac4131b768ff3d',
      token: token
    }
  }

  request(options, function(error, response, body) {
    if (error) throw new Error(error);
    var data = JSON.parse(body);
    idList = data[0].id

    initContratti(idList, token, function () {
      var optionsListContratti = {
        method: 'GET',
        url: "https://api.trello.com/1/lists/" + idListContrattiScatola + "/cards",
        qs: {
          key: '4dd8f72d0f8b9dfb50ac4131b768ff3d',
          token: token
        }
      }

      request(optionsListContratti, function(error, response, body) {
        if (error) throw new Error(error);
        var data = JSON.parse(body);
        var cardIndex
        for (var i = 0; i < 3; i++) {
          getCardIndex(data.length - i, function(cardIndex) {
            var optionsMove = {
              method: 'PUT',
              url: "https://api.trello.com/1/cards/" + data[cardIndex].id + "?idList=" + idList + "&idBoard=" + idBoard,
              qs: {
                key: '4dd8f72d0f8b9dfb50ac4131b768ff3d',
                token: token
              }
            };

            request(optionsMove, function(error, response, body) {
              if (error) throw new Error(error);
            });
          })

        }
        rsp.success = true;
        res.status(200).json(rsp);
      });
    });
  });
});

function initContratti(idList, token, callback) {
  //Get cards
  var options = {
    method: 'GET',
    url: "https://api.trello.com/1/lists/" + idList + "/cards",
    qs: {
      key: '4dd8f72d0f8b9dfb50ac4131b768ff3d',
      token: token
    }
  };

  request(options, function(error, response, body) {
    if (error) throw new Error(error);
    var data = JSON.parse(body);
    moveContratti(idListContrattiScatola, data, idBoardScatola, token, function () {
      callback()
    })
  });
}

//All Player's contracts in Scatola
function moveContratti(idList, data, idBoard, token, callback) {
  for (var i = 0; i < data.length; i++) {
    var optionsMove = {
      method: 'PUT',
      url: "https://api.trello.com/1/cards/" + data[i].id + "?idList=" + idList + "&idBoard=" + idBoard,
      qs: {
        key: '4dd8f72d0f8b9dfb50ac4131b768ff3d',
        token: token
      }
    };

    request(optionsMove, function(error, response, body) {
      if (error) throw new Error(error);
      var data = JSON.parse(body);
    });
  }
  callback()
}

function getCardIndex(len, callback) {
  cardIndex = Math.floor(Math.random() * len) + 1;
  callback(cardIndex)
}

function setPosition(board, index, token) {
  var options = {
    method: 'GET',
    url: "https://api.trello.com/1/boards/" + board + "/lists?filter=open",
    qs: {
      key: '4dd8f72d0f8b9dfb50ac4131b768ff3d',
      token: token
    }
  };

  request(options, function(error, response, body) {
    if (error) throw new Error(error);
    var data = JSON.parse(body);
    //All players in Start position
    for (var i = 0; i < data.length; i++) {
      if (data[i].name == "Posizione") {
        //Ho l'id della lista "posizione"
        archive(data[i].id, token)
        move(data[i].id, idStartCard, token)
      }
    }
  });
}

function move(idList, idCard, token) {
  var moveOptions = {
    method: 'POST',
    url: 'https://api.trello.com/1/cards?idCardSource=' + idCard + '&idList=' + idList,
    qs: {
      key: '4dd8f72d0f8b9dfb50ac4131b768ff3d',
      token: token
    }
  };
  request(moveOptions, function(error, response, body) {
    if (error) throw new Error(error);
  });
}

function setIdStardCard(idBoardScatola, token, callback) {
  var options = {
    method: 'GET',
    url: "https://api.trello.com/1/boards/" + idBoardScatola + "/lists?filter=open",
    qs: {
      key: '4dd8f72d0f8b9dfb50ac4131b768ff3d',
      token: token
    }
  };
  request(options, function(error, response, body) {
    if (error) throw new Error(error);
    var data = JSON.parse(body);
    idListContrattiScatola = data[1].id
    //Get idStartCard
    var optionsPlancia = {
      method: 'GET',
      url: "https://api.trello.com/1/lists/" + data[0].id + "/cards",
      qs: {
        key: '4dd8f72d0f8b9dfb50ac4131b768ff3d',
        token: token
      }
    };
    request(optionsPlancia, function(error, response, body) {
      if (error) throw new Error(error);
      var cardsPlancia = JSON.parse(body);
      idStartCard = cardsPlancia[0].id
      callback()
    });
  });
}

function archive(idList, token) {
  var optionsPlancia = {
    method: 'GET',
    url: "https://api.trello.com/1/lists/" + idList + "/cards",
    qs: {
      key: '4dd8f72d0f8b9dfb50ac4131b768ff3d',
      token: token
    }
  };
  request(optionsPlancia, function(error, response, body) {
    if (error) throw new Error(error);
    var cards = JSON.parse(body);
    for (var i = 0; i < cards.length; i++) {
      var options = {
        method: 'PUT',
        url: 'https://api.trello.com//1/cards/' + cards[i].id + '/closed?value=true',
        qs: {
          key: '4dd8f72d0f8b9dfb50ac4131b768ff3d',
          token: token
        }
      };
      request(options, function(error, response, body) {
        if (error) throw new Error(error);
        var data = JSON.parse(body);
      });
    }
  });
}


module.exports = router;
