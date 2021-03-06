var express = require('express');
var request = require('request');
const EventEmitter = require('events');

class MyEmitter extends EventEmitter {}
const myEmitter = new MyEmitter();

// increase the limit
myEmitter.setMaxListeners(15);

var router = express.Router();

var cardIndex
var organizations = {}

//Get user organizations
router.get("/organization*", function(req, res) {
  var options = {
    method: 'GET',
    url: 'https://api.trello.com/1/members/me' + '/organizations/',
    qs: {
      key: 'xxx',
      token: req.query.token
    }
  };

  request(options, function(error, response, body) {
    var rsp = {}
    if (error) {
      console.log("Trello request error: " + error);
      rsp.success = false
      rsp.message = "Si è riscontrato un problema con Trello. \n Si prega di riprovare."
      res.status(200).send(rsp)
    } else {
      var data = JSON.parse(body);
      var org = req.query.organization
      var id = req.query.id

      if (organizations.org == undefined) {
        organizations.org = []
      }

      var pendingOrg = {
        name: org
      }

      if (organizations.org.find(x => x.name === org) == undefined) {
        organizations.org.push(pendingOrg)
      }
      var index = organizations.org.findIndex(x => x.name === org)

      if (organizations.org[index].players == undefined) {
        organizations.org[index].players = []
      }
      var pendingUsr = {
        id: id
      }
      if (organizations.org[index].noc == undefined) {
        organizations.org[index].noc = 0
      }
      if (organizations.org[index].players.find(x => x.id === id) == undefined) {
        organizations.org[index].players.push(pendingUsr)
        organizations.org[index].noc += 1
      }

      if (checkOrg(data, req.query.organization)) {
        getBoards(req.query.organization, req.query.token, function(play) {
          if (play) {
            var index = organizations.org.findIndex(x => x.name === org)
            rsp.success = true;
            if (organizations.org != undefined) {
              if (index != -1) {
                if (organizations.org[index].nop != undefined && organizations.org[index].nop != 0) {
                  rsp.isSetNop = true
                }
              }
            } else {
              rsp.isSetNop = false
            }
            rsp.message = "Ok to play";
            rsp.boardLen = organizations.org[index].boardLen - 1
            res.status(200).json(rsp);
          } else {
            rsp.success = false;
            rsp.message = "Non è possibile giocare con questo gruppo, controlla le bacheche!";
            res.status(200).json(rsp);
          }
        })
      } else {
        rsp.success = false;
        rsp.message = "Sembra che tu non faccia parte di questo gruppo!";
        res.status(200).json(rsp);
      }
    }
  });
})

function sendBroadcast(msg) {
  var wss = app.get("wss")
  wss.clients.forEach(function each(client) {
    client.send(msg);
  });
}

router.get("/initialize*", function(req, res) {
  var org = req.query.organization
  var options = {
    method: 'GET',
    url: 'https://api.trello.com/1/members/me' + '/organizations/',
    qs: {
      key: 'xxx',
      token: req.query.token
    }
  };

  request(options, function(error, response, body) {
    var rsp = {}
    if (error) {
      console.log(error);
    } else {
      var data = JSON.parse(body);

      var index = organizations.org.findIndex(x => x.name === org)
      var indexOrg
      for (var i = 0; i < data.length; i++) {
        if (data[i].name == org) {
          indexOrg = i
          organizations.org[index].idBoardScatola = data[i].idBoards[0]
        }
      }
      setIdStartCard(organizations.org[index].idBoardScatola, org, req.query.token, function() {
        for (var i = 1; i < data[indexOrg].idBoards.length; i++) {
          setPosition(data[indexOrg].idBoards[i], org, i, req.query.token)
          done(operations, data[indexOrg].idBoards.length)
        }
      })
    }
  });
});

router.get("/nop", function(req, res) {
  var rsp = {}
  var org = req.query.organization
  var nop = req.query.nop
  var id = req.query.id

  app.set("organizations", organizations)

  if (organizations.org == undefined) {
    organizations.org = []
  }

  var pendingOrg = {
    name: org
  }

  if (organizations.org.find(x => x.name === org) == undefined) {
    organizations.org.push(pendingOrg)
  }
  var index = organizations.org.findIndex(x => x.name === org)
  if (organizations.org[index].players == undefined) {
    organizations.org[index].players = []
  }
  var pendingUsr = {
    id: id
  }

  if (organizations.org[index].nop == undefined || organizations.org[index].nop == 0) {
    organizations.org[index].nop = nop
  }

  if (organizations.org != undefined) {
    if (organizations.org[index].noc == undefined) {
      organizations.org[index].noc = 0
    }
    if (organizations.org[index].players.find(x => x.id === id) == undefined) {
      organizations.org[index].players.push(pendingUsr)
      organizations.org[index].noc += 1
    }


    if (organizations.org[index].noc == organizations.org[index].nop) {
      rsp.success = true;
      rsp.isStart = false;
      rsp.message = "Inizializzo la partita...";
      if (organizations.org[index].isStart == undefined || organizations.org[index].isStart == false) {
        sendBroadcast(rsp.message)
        rsp.id = organizations.org[index].players[0].id

        var brd = {
          'resultDice': null,
          'id': rsp.id
        }

        sendBroadcast(JSON.stringify(brd))
      } else {
        rsp.isStart = organizations.org[index].isStart;
      }
      res.status(200).json(rsp)
    } else if (organizations.org[index].noc < organizations.org[index].nop) {
      rsp.message = "Attendo giocatori...";
      rsp.success = true
      rsp.wait = true;
      sendBroadcast(rsp.message)
    } else {
      rsp.message = "La partita è gia iniziata";
      rsp.success = false
      res.status(200).json(rsp);
    }
  } else {
    rsp.message = "Errore interno, torna alla Home e riprova.";
    rsp.success = false
    res.status(200).json(rsp);
  }
});


router.get("/start*", function(req, res) {
  var rsp = {}
  var org = req.query.organization
  var index = organizations.org.findIndex(x => x.name === org)
  console.log("Distribuiti: " + organizations.org[index].distibuited);
  console.log("Connessi: " + organizations.org[index].noc);
  if (organizations.org[index].isStart != undefined && (organizations.org[index].distibuited >= organizations.org[index].noc) ) {
    rsp.isStart = organizations.org[index].isStart
  } else {
    rsp.isStart = false
  }
  rsp.success = true
  res.status(200).json(rsp);
})

router.get("/contratti*", function(req, res) {
  console.log("Chiamata Contratti");

  var rsp = {}
  var idBoard = req.query.boardId
  var token = req.query.token
  var org = req.query.organization
  var idPlayer = req.query.idPlayer
  var idList

  var index = organizations.org.findIndex(x => x.name === org)
  var indexPlayer = organizations.org[index].players.findIndex(x => x.id === idPlayer)

  if(organizations.org[index].distibuited == undefined){
    organizations.org[index].distibuited = 1
  } else {
    organizations.org[index].distibuited++
  }

  if (organizations.org[index].isStart == undefined) {
    organizations.org[index].isStart = true
  }

  var options = {
    method: 'GET',
    url: "https://api.trello.com/1/boards/" + idBoard + "/lists?filter=open",
    qs: {
      key: 'xxx',
      token: token
    }
  }

  request(options, function(error, response, body) {
    if (error) throw new Error(error);
    var data = JSON.parse(body);
    idList = data[0].id
    idSoldi = data[2].id

    idContratti = idList

    var pendingCon = {
      id: idPlayer,
      idBoard: idBoard,
      idContratti: idContratti,
      idSoldi: idSoldi
    }

    organizations.org[index].players[indexPlayer] = pendingCon;

    console.log(organizations.org[index].players[indexPlayer]);

    initContratti(idList, org, token, function() {
      var optionsListContratti = {
        method: 'GET',
        url: "https://api.trello.com/1/lists/" + organizations.org[index].idListContrattiScatola + "/cards",
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
            if (data[cardIndex] != undefined) {
              var optionsMove = {
                method: 'PUT',
                url: "https://api.trello.com/1/cards/" + data[cardIndex].id + "?idList=" + idList + "&idBoard=" + idBoard,
                qs: {
                  key: '4dd8f72d0f8b9dfb50ac4131b768ff3d',
                  token: token
                }
              };

              request(optionsMove, function(error, response, body) {
                if (error) {
                  rsp.success = false;
                  rsp.message = "Trello Error: " + error
                  res.status(200).json(rsp);
                }
                var data = JSON.parse(body)
              });
            } else {
              rsp.success = false;
              rsp.message = "Si è riscontrato un problema con Trello. \n Si prega di riprovare."
              res.status(200).json(rsp);
            }
          })
        }
        rsp.success = true;
        res.status(200).json(rsp);
      });
    });
  });
});

router.get("/gameover*", function(req, res) {
  var rsp = {}
  var org = req.query.organization
  var index = organizations.org.findIndex(x => x.name === org)

  organizations.org[index].players = []
  organizations.org[index].nop = 0
  organizations.org[index].noc = 0
  organizations.org[index].isStart = false

  rsp.success = true;
  rsp.message = "Partita conclusa!"
  res.status(200).json(rsp);
})


/*

datasets: [
  labels: ["January", "February", "March", "April", "May", "June", "July"],
  datasets: [{
        label: "My First dataset",
        backgroundColor: 'rgb(255, 99, 132)',
        borderColor: 'rgb(255, 99, 132)',
        data: [0, 10, 5, 2, 20, 30, 45],
    }]
]

*/

var colors = ["blue", "red"]
var send = false

router.get("/stats*", function(req, res) {
  var rsp = {}
  var org = req.query.organization
  var token = req.query.token
  if (organizations.org != undefined) {
    var index = organizations.org.findIndex(x => x.name === org)

    rsp.datasetsContratti = []
    rsp.datasetsSoldi = []
    rsp.labels = []


    var dataContratti = {}
    var dataSoldi = {}
    dataContratti.data = []
    dataSoldi.data = []

    for (var i = 0; i < organizations.org[index].players.length; i++) {
      (function(i){
        var id = organizations.org[index].players[i].id
        var idBoard = organizations.org[index].players[i].idBoard
        var idContratti = organizations.org[index].players[i].idContratti
        var idSoldi = organizations.org[index].players[i].idSoldi

        console.log("IDSOLDI: " + idSoldi);

        var options = {
          method: 'GET',
          url: 'https://api.trello.com/1/members/' + id,
          qs: {
            key: 'xxx',
            token: req.query.token
          }
        };

        request(options, function (error, response, body) {
          if (error) throw new Error(error);
          var body = JSON.parse(body)

          rsp.labels.push(body.fullName)

          var optionsContatti = {
            method: 'GET',
            url: 'https://api.trello.com/1/lists/' + idContratti + '/cards',
            qs: {
              key: 'xxx',
              token: req.query.token
            }
          }


          request(optionsContatti, function(error, response, body) {
            var body = JSON.parse(body)

            rsp.datasetsContratti.push(body.length)

            var optionsSoldi = {
              method: 'GET',
              url: 'https://api.trello.com/1/lists/' + idSoldi + '/cards',
              qs: {
                key: 'xxx',
                token: req.query.token
              }
            }

            request(optionsSoldi, function(error, response, body) {

              var body = JSON.parse(body)
              var sum = 0

              for (var i = 0; i < body.length; i++) {
                num = parseInt(body[i].name.split("€")[0])
                sum += num
              }

              rsp.datasetsSoldi.push(sum)

              doneStats(res, rsp, organizations.org[index].players.length)
            });
          });
        });
      }).call(this, i)
    }
  }
  else {
    rsp.isStart = false;
    rsp.success = true;
    rsp.datasets = [{
      label: "",
      data: [0],
    }]
    res.status(200).json(rsp);
  }
})

var cicle = 0
function doneStats(res, rsp, len) {
  cicle++
  if (cicle == len) {
    console.log("Nomi:" + rsp.labels)
    console.log("Soldi: " + rsp.datasetsSoldi);
    console.log("Contratti: " + rsp.datasetsContratti);
    cicle = 0
    rsp.isStart = true;
    rsp.success = true;
    res.status(200).json(rsp);
  }
}

function initContratti(idList, org, token, callback) {
  //Get cards
  var options = {
    method: 'GET',
    url: "https://api.trello.com/1/lists/" + idList + "/cards",
    qs: {
      key: 'xxx',
      token: token
    }
  };

  request(options, function(error, response, body) {
    if (error) throw new Error(error);
    var data = JSON.parse(body);
    var index = organizations.org.findIndex(x => x.name === org)
    moveContratti(idList, organizations.org[index].idListContrattiScatola, organizations.org[index].idBoardScatola, token, function() {
      callback()
    })
  });
}

//All Player's contracts in Scatola
function moveContratti(idListPlayer, idListScatola, idBoardScatola, token, callback) {
  var options = {
    method: 'POST',
    url: 'https://api.trello.com/1/lists/' + idListPlayer + '/moveAllCards',
    qs: {
      idBoard: idBoardScatola,
      idList: idListScatola,
      key: 'xxx',
      token: token
    }
  };

  request(options, function(error, response, body) {
    if (error) throw new Error(error);
    var data = JSON.parse(body);
    callback()
  });
}

function getCardIndex(len, callback) {
  cardIndex = Math.floor(Math.random() * len) + 1;
  callback(cardIndex)
}

function setPosition(board, org, index, token) {
  var options = {
    method: 'GET',
    url: "https://api.trello.com/1/boards/" + board + "/lists?filter=open",
    qs: {
      key: 'xxx',
      token: token
    }
  };

  request(options, function(error, response, body) {
    if (error) throw new Error(error);
    var data = JSON.parse(body);
    //All players in Start position
    var operations = 0
    var idListPosizione
    var idListSoldi
    for (var i = 0; i < data.length; i++) {
      if (data[i].name == "Posizione") {
        var index = organizations.org.findIndex(x => x.name === org)
        archive(data[i].id, token, function(idList) {
          move(idList, organizations.org[index].idStartCard, token)
        })
      }
      if (data[i].name == "Contratti") {
        var index = organizations.org.findIndex(x => x.name === org)
        moveContratti(data[i].id, organizations.org[index].idListContrattiScatola, organizations.org[index].idBoardScatola, token, function () {})
      }
    }
  });
}

function move(idList, idCard, token) {
  var moveOptions = {
    method: 'POST',
    url: 'https://api.trello.com/1/cards?idCardSource=' + idCard + '&idList=' + idList,
    qs: {
      key: 'xxx',
      token: token
    }
  };
  request(moveOptions, function(error, response, body) {
    var data = JSON.parse(body);
    if (error) throw new Error(error);
  });
}

function setIdStartCard(idBoardScatola, org, token, callback) {

  var options = {
    method: 'GET',
    url: "https://api.trello.com/1/boards/" + idBoardScatola + "/lists?filter=open",
    qs: {
      key: 'xxx',
      token: token
    }
  };
  request(options, function(error, response, body) {
    if (error) throw new Error(error);
    var data = JSON.parse(body);
    var index = organizations.org.findIndex(x => x.name === org)
    organizations.org[index].idListContrattiScatola = data[1].id
    //Get idStartCard
    var optionsPlancia = {
      method: 'GET',
      url: "https://api.trello.com/1/lists/" + data[0].id + "/cards",
      qs: {
        key: 'xxx',
        token: token
      }
    };
    request(optionsPlancia, function(error, response, body) {
      if (error) throw new Error(error);
      var cardsPlancia = JSON.parse(body);
      var index = organizations.org.findIndex(x => x.name === org)
      organizations.org[index].idStartCard = cardsPlancia[0].id
      callback()
    });
  });
}

function archive(idList, token, callback) {
  var options = {
    method: 'POST',
    url: 'https://api.trello.com/1/lists/' + idList +'/archiveAllCards',
    qs: {
      key: 'xxx',
      token: token
    }
  };

  request(options, function(error, response, body) {
    if (error) throw new Error(error);
    callback(idList)
  });
}

//Get logged user boards
function getBoards(org, token, callback) {
  var options = {
    method: 'GET',
    url: 'https://api.trello.com/1/organization/' + org + '/boards/',
    qs: {
      key: 'xxx',
      token: token
    }
  };

  request(options, function(error, response, body) {
    if (error) throw new Error(error);
    var boards = JSON.parse(body);
    var index = organizations.org.findIndex(x => x.name === org)
    organizations.org[index].boardLen = boards.length
    checkBoards(boards, org, token, function(play) {
      callback(play)
    })
  });
}

var operations = 0
//Check if Boards are ok
function checkBoards(boards, org, token, callback) {
  operations = 0
  var len = boards.length
  for (var i = 0; i < boards.length; i++) {
    var options = {
      method: 'GET',
      url: 'https://api.trello.com/1/boards/' + boards[i].id + '/lists?filter=open',
      qs: {
        key: 'xxx',
        token: token
      }
    };
    if (boards[i].name == "Scatola") {
      checkScatola(options, org, token, function(play) {
        done(play, len, callback)
      })
    } else {
      checkPlayer(options, token, function(play) {
        done(play, len, callback)
      })
    }
  }
}

var playLocal = true

function done(play, len, callback) {
  if (play == false) {
    playLocal = false;
  }
  operations++
  if (operations == len) {
    callback(playLocal)
    playLocal = true;
  }
}



//Check if Board is ok
function checkScatola(options, org, token, callback) {
  request(options, function(error, response, body) {
    if (error) throw new Error(error);
    var lists = JSON.parse(body);
    var play = true
    if (lists.length > 0) {
      for (var i = 0; i < lists.length; i++) {
        if (lists[i].name != "Plancia" && lists[i].name != "Contratti" && lists[i].name != "Imprevisti/Probabilità" && lists[i].name != "Banca" && lists[i].name != "Istruzioni") {
          play = false
        }
      }
      if (play) {
        var index = organizations.org.findIndex(x => x.name === org)
        organizations.org[index].listPlanciaId = lists[0].id
      }
      callback(play)
    } else {
      callback(false)
    }
  });
}


//Check if Board is ok
function checkPlayer(options, token, callback) {
  request(options, function(error, response, body) {
    if (error) throw new Error(error);
    var lists = JSON.parse(body);
    var play = true
    if (lists.length > 0) {
      for (var i = 0; i < lists.length; i++) {
        if (lists[i].name != "Contratti" && lists[i].name != "Posizione" && lists[i].name != "Soldi") {
          play = false
        }
      }
      callback(play)
    } else {
      callback(false)
    }
  });
}

//Check if user is member of this organization
function checkOrg(data, organization) {
  var ok = false
  for (var i = 0; i < data.length; i++) {
    if (data[i].name == organization) {
      ok = true
    }
  }
  return ok
}

function sleep(milliseconds) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds){
      break;
    }
  }
}

module.exports = router;
