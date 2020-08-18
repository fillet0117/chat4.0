// var fs      = require('fs')
// var https   = require('https')
// var options = {
//   key: fs.readFileSync('./key/private.key'),
//   cert: fs.readFileSync('./key/certificate.crt'),
//   ca: fs.readFileSync('./key/ca_bundle.crt'),
// };
const path = require("path");
const express = require("express");
const app = express();
const server = https.createServer(options, app);
const io = require("socket.io")(server);
const bodyParser = require("body-parser");
const uuidv1 = require("uuidv1");
const jwtDecode = require("jwt-decode");
const moment = require("moment");

// 模組
const { dbquery, dbinsert } = require("./utils/DBquery");
const {
  clientJoin,
  getCurrentClient,
  clientLeave,
  getClientRoom,
  getAllClient,
  clientExist,
  clientEditStatus,
  clientEditArea,
} = require("./utils/clients");
const {
  managerJoin,
  getCurrentManager,
  managerLeave,
  getAllManager,
  managerExist,
  managerEditStatus,
  managerAddRoom,
  managerDeleteRoom,
  checkManagerInRoom,
  countOnlineManager,
  getNoBusyManager,
} = require("./utils/managers");
const managers = require("./utils/managers");
const { request } = require("http");
// 設定port
const port = 4477;
// 攔截和解析所有的請求(處理utf-8編碼的資料)
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// router
app.all("/", (req, res) => {
  if (req.body.token != "") {
    res.cookie("SameSite", "Strict"); // google瀏覽器對cookie的設定
    res.cookie("token", req.body.token); // 拿user的token存入聊天室的cookie裡
  }
  res.sendFile(path.join(__dirname, "public")); // 開啟網址後會傳入public中的index.html
});
// 客服端的訊息提示音
app.get("/aud", (req, res) => {
  res.sendFile(path.join(__dirname, "public/audio/ring.mp3"));
});
// 客戶端的圖跟css
app.get("/router/:dir/:name", (req, res) => {
  const filename = req.params.name;
  const dir = req.params.dir;
  res.sendFile(path.join(__dirname, `public/${dir}/${filename}`));
});
// 監聽連線
server.listen(port, "0.0.0.0", function () {
  console.log(`Server running on port ${port}`);
});

// socekt 連線
io.on("connection", (socket) => {
  console.log(`connection: ${socket.id}`);

  // 產生一組不重複的id, 給客戶端做room id用
  var uuid = uuidv1();
  // 接收訊息 // 修改參數 roomid, msgname, msg, pic, time
  socket.on("publish", (roomid, msg, pic, time) => {
    var user = getCurrentClient(socket.id);
    var manager = getCurrentManager(socket.id);
    var name = "";
    if (user !== false) {
      io.sockets.in("csroom").emit("setwaittime", roomid);
      name = user.name;
    } else if (manager !== false) {
      io.sockets.in("csroom").emit("reloadtime", roomid);
      name = manager.name;
    }
    // publish(roomid, msgname, msg, pic, time);
    io.sockets
      .in(roomid)
      .emit("msgReceived", name, { msg: msg }, roomid, pic, time);
    // if (managerChat.has(id)) {
    //   // 後台通知
    //   chatValue = managerChat.get(id).values();
    //   chatId = chatValue.next().value;
    //   if (managerName.has(id)) {
    //     csname = managerName.get(id).values();
    //     maname = csname.next().value;
    //   }
    //   if (MsgName !== maname) {
    //     io.to(chatId).emit(
    //       "msgReceived",
    //       MsgName,
    //       { msg: msg },
    //       roomId,
    //       pic,
    //       time
    //     );
    //   }
    // }
  });

  // 傳送roomid到客戶端
  socket.on("getUUID", uuid);

  // 訂閱房間
  socket.on("orderroom", (roomid, name, detial, linktime, lang) => {
    orderroom(socket, roomid, name, detial, linktime, lang);
  });

  // 客戶有登入, 訂閱房間
  socket.on("getId", (userCookie, uuid) => {
    if (userCookie.token !== undefined && userCookie.token) {
      let decode = jwtDecode(userCookie.token);
      let id = decode.aud;
      socket.emit("setId", id);
      var sqlacc = `select accountcode from a_account where accountid = ${id}`; // 取得會員帳號
      var sqlacc2 = `select firstname from a_account_data where accountid = ${id}`; // 取得會員綁定的銀行卡姓名
      var sql = `${sqlacc};${sqlacc2}`;
      dbquery(sql).then((data) => {
        var name = "";
        if (data != false && data[0] && data[0][0].accountcode != null) {
          name = data[0][0].accountcode;
        }
        if (
          data[1] != false &&
          data[1][0].firstname != null &&
          data[1][0].firstname != ""
        ) {
          name = `${name}( ${data[1][0].firstname} )`;
        }
        socket.emit("setaccountcode", name);
        redis.hgetall(`user_${id}`, (err, results) => {
          if (JSON.stringify(results) != "{}") {
            // 會員已經有room存在redis中了
            socket.emit("setCookie", results.room);
          } else {
            // 會員第一次進入客服系統
            redis.hmset(`user_${id}`, { room: uuid });
            socket.emit("setCookie", uuid);
          }
        });
      });
    }
  });

  // 訊息存入db // 改動-> 傳的參數原本有roomid, uid, mid, content, date, name = null
  socket.on("insertcontent", (roomid, content, date) => {
    var curruser = {};
    var uid = "";
    var mid = "";
    if ((client = clientExist(socket.id)) !== false) {
      curruser = getCurrentClient(socket.id);
      uid = curruser.name.split("(");
    }
    if ((manager = managerExist(socket.id)) !== false) {
      curruser = getCurrentManager(socket.id);
      mid = curruser.accountcode;
    }
    var sql =
      "insert into content (id, room, uid, mid, content, created_at) value (0, ?, ?, ?, ?, ?)";
    var addsqlparams = [roomid, uid, mid, content, date];
    dbinsert(sql, addsqlparams);
  });

  // 客服連線
  socket.on("getbusy", (status, mid) => {
    socket.join("csroom");
    var nickname = "";
    var accountcode = "";
    var managers = {};
    var users = {};
    if ("token" in mid) {
      let mid = jwtDecode(mid.token).aud;
      let sql = `select name, accountcode, photo from m_manager where managerid = ${mid}`;
      socket.emit("getMid", mid);
      // 判斷是否雙開
      redis.exists(`double:${mid}`, function (error, results) {
        if (results != false) {
          socket.emit("double", "yes");
        } else {
          socket.emit("double", "no");
          socket.disconnect();
          return;
        }
      });
      dbquery(sql).then((data) => {
        nickname = data[0].name;
        accountcode = data[0].accountcode;
        redis.hmset(`chat_socket: ${socket.id}`, {
          name: nickname,
          id: mid,
          busyornot: status,
        });
        socket.emit("getNickname", nickname, accountcode);
        managers = getAllManager();
        managers.forEach((value) => {
          let bu = 0;
          if (status === "disc") {
            bu = 2;
          }
          io.sockets.in("csroom").emit("getallcs", value.id, value.name, bu);
        });
        let sql = `Select photo from m_manager_photo where id = ${data[0].photo}`;
        dbquery(sql).then((photo) => {
          if (photo != false) {
            socket.emit("getpic", photo[0].photo);
          }
        });
        managerJoin(socket.id, nickname, mid, [], status, accountcode);
      });
      users = getAllClient();
      if (users.length != 0) {
        users.forEach((user) => {
          let color;
          if (user.status === 0) {
            color = false;
          } else {
            color = true;
          }
          io.to(socket.id).emit(
            "getRoom",
            user.room,
            user.name,
            user.detial,
            user.linktime,
            color
          );
          managers = getAllManager();
          managers.forEach((manager) => {
            if (manager.rooms.length != 0 && manager.rooms.indexOf(user.room)) {
              io.to(socket.id).emit("whichcsinroom", manager.name, manager.id);
            }
          });
        });
      }
      setTimeout(() => {
        getNoservice(socket, status, nickname);
      }, 200);
      io.sockets.in("csroom").emit("user_online", users.length);
      redis.hmset(`double:${mid}`, { mid: mid });
    } else {
      socket.disconnect();
    }
  });

  // cs點按鈕進入room // 修改參數 roomid, name, status
  socket.on("getInRoom", (roomid) => {
    let manager = getCurrentManager(socket.id);
    let user = getClientRoom(roomid);
    if (manager.status !== "disc" && user.length !== 0) {
      user = user[0];
      io.sockets
        .in(user.room)
        .emit("msgReceived", "System", { msg: `${name} 加入` }, user.room);
      io.sockets.in("csroom").emit("getuserservice", user.room, true);
      io.sockets.in("csroom").emit("whichcsinroom", manager.name, user.room);
      if (user.status === 0) {
        user = clientEditStatus(user.id, 1);
      }
      manager = managerAddRoom(socket.id, user.room);
      socket.join(user.room);
      getOnline(user.room);
      if (manager.rooms.length === 0) {
        if (manager.status === "auto") {
          io.sockets
            .in("csroom")
            .emit("cschangestatus", manager.id, 0, manager.name);
        } else if (manager.status === "manu") {
          io.sockets
            .in("csroom")
            .emit("cschangestatus", manager.id, 1, manager.name);
        }
      }
      getRecord(user.room);
    }
  });

  // 將user踢出
  socket.on("kickeduser", (roomid) => {
    let user = getClientRoom(roomid);
    if (user.length !== 0) {
      user = user[0];
      io.to(user.id).emit("kicked");
    }
  });

  // cs join room
  socket.on("joinRoom", (roomid) => {
    socket.join(roomid);
  });

  // cs離開room // 修改參數 roomid, name, status
  socket.on("leaveroom", (roomid) => {
    let user = getClientRoom(roomid);
    if (user.length === 0) {
      return;
    } else {
      user = user[0];
      let manager = managerDeleteRoom(socket.id, roomid);
      socket.leave(roomid);
      redis.hgetall(`chat_socket: ${socket.id}`, (error, result) => {
        if (Object.keys(result).length != 0) {
          redis.srem(`cs_${result.id}`, roomId);
        }
      });
      io.sockets
        .in(roomid)
        .emit(
          "msgReceived",
          "System",
          { msg: `${manager.name} 已離開` },
          roomid
        );
      io.sockets
        .in("csroom")
        .emit("delcsinroom", manager.name, roomid, socket.id);
      let ary = checkManagerInRoom(roomid);
      if (ary.length === 0) {
        // 這裡要再做修改
        csid = getRedis();
        setcs(csid, roomid);
      }
    }
    if (manager.rooms.length === 0) {
      if (manager.status === "auto") {
        io.sockets
          .in("csroom")
          .emit("cschangestatus", socket.id, 0, manager.name);
      } else if (manager.status === "manu") {
        io.sockets
          .in("csroom")
          .emit("cschangestatus", socket.id, 1, manager.name);
      }
    }
    getOnline(roomid);
  });

  // cs改變狀態 // 修改參數 status, current, name
  socket.on("getbusyvalue", (status) => {
    var count = countOnlineManager();
    var manager = getCurrentClient(socket.id);
    var bu = "";
    if (manager.status === "disc" && status !== "disc") {
      manager = managerEditStatus(manager.id, status);
      if (status === "manu") {
        bu = 1;
      } else if (status === "auto") {
        bu = 0;
      }
    } else if (manager.status === "manu" && status !== "manu") {
      if (manager.rooms.length !== 0 && status === "disc") {
        return;
      } else {
        if (manager.rooms.length === 0 && status === "disc") {
          bu = 2;
        } else if (status === "auto") {
          bu = 0;
          if (manager.rooms.length === 0) {
            getNoservice(socket, status, manager.name);
          }
        }
        manager = managerEditStatus(manager.id, status);
      }
    } else if (manager.status === "auto" && status !== "auto") {
      if (manager.rooms.length !== 0 && status === "disc") {
        return;
      } else {
        if (manager.rooms.length === 0 && status === "disc") {
          bu = 2;
        } else if (status === "manu") {
          bu = 1;
        }
        manager = managerEditStatus(manager.id, status);
      }
    }
    io.sockets
      .in("csroom")
      .emit("cschangestatus", manager.id, bu, manager.name);
    io.sockets.in("csroom").emit("csonline", count);
  });

  // 拉cs進room // 修改參數 csSocketId, roomId, csName
  socket.on("cspull", (cssocketid, roomid) => {
    var time = moment().format("YYYY/MM/DD HH:mm:ss");
    var manager = getCurrentManager(cssocketid);
    var user = getClientRoom(roomid);
    if (
      manager !== undefined &&
      manager.rooms.indexOf(roomid) !== -1 &&
      user !== undefined
    ) {
      getRecord(roomid);
      manager = managerAddRoom(manager.id, roomid);
      io.to(manager.id).emit("join", roomid);
      if (manager.status === "auto") {
        io.sockets
          .in("csroom")
          .emit("cschangestatus", manager.id, 0, manager.name);
      } else if (manager.status === "manu") {
        io.sockets
          .in("csroom")
          .emit("cschangestatus", manager.id, 1, manager.name);
      }
      io.to(manager.id).emit("notic_getinroom", roomid);
      // noticbackend(manager.id, roomId);
      io.sockets
        .in(roomid)
        .emit("msgReceived", "System", { msg: `${manager.name} 加入` }, roomid);
      io.sockets.in("csroom").emit("getuserservice", roomid, true);
      io.sockets.in("csroom").emit("whichcsinroom", manager.name, roomid);
      getOnline(roomid);
      redis.hgetall(`chat_socket: ${csSocketId}`, function (error, results) {
        if (!error && Object.keys(results).length != 0) {
          redis.sadd(`cs_${results.id}`, roomId);
        }
      });
    }
  });

  // 後台訊息用
  // socket.on("getchat", () => {});

  // 後台訊息socket id對應cs socket id
  // socket.on("correspond", function (corrId) {
  //   if (!managerChat.has(socket.id)) {
  //     managerChat.set(socket.id, new Set());
  //   }
  //   managerChat.get(socket.id).add(corrId);
  //   console.log("**************getchat******************");
  //   listall();
  // });

  // 離線
  socket.on("disconnect", () => {
    console.log(`bye! ${socket.id}`);
    var user = clientLeave(socket.id);
    var manager = managerLeave(socket.id);
    if (user !== false) {
      let managerinroom = checkManagerInRoom(user.room);
      io.sockets
        .in(user.room)
        .emit("msgReceived", "System", { msg: "會員已離開" }, roomid);
      managerinroom.forEach((value) => {
        value = managerDeleteRoom(value.id, user.room);
        if (value.rooms.length === 0 && value.status === "auto") {
          let nouser = getNoServiceClient();
          if (nouser !== false) {
            value = managerAddRoom(value.id, nouser.room);
            getRecord(nouser.room);
            io.sockets
              .in(nouser.room)
              .emit(
                "msgReceived",
                "System",
                { msg: `${value.name} 加入` },
                nouser.room
              );
            io.sockets.in("csroom").emit("getuserservice", nouser.room, true);
            io.sockets
              .in("csroom")
              .emit("whichcsinroom", value.name, nouser.room);
            io.to(value.id).emit("join", nouser.room);
            getOnline(nouser.room);
            io.to(value.id).emit("notic_getinroom", nouser.room);
          }
        }
        redis.hgetall(`chat_socket: ${id}`, (error, results) => {
          if (!error) {
            redis.srem(`cs_${results.id}`, user.room);
          }
        });
      });
      io.sockets.in("csroom").emit("userleave", user.room);
      io.sockets.in("Chat").emit("userleave", user.name);
    }
    if (manager !== false) {
      manager.rooms.forEach((room) => {
        socket.leave(room);
        io.sockets
          .in(room)
          .emit(
            "msgReceived",
            "System",
            { msg: `${manager.name} 已離開` },
            room
          );
        io.sockets
          .in("csroom")
          .emit("delcsinroom", manager.name, room, manager.id);
        let ary = checkManagerInRoom(room);
        if (ary.length === 0) {
          // 要再做修改
          let cs = getRedis();
          setcs(cs, room);
        }
      });
      io.sockets.in("csroom").emit("csleave", manager.id);
      redis.hgetall(`chat_socket: ${manager.id}`, (error, results) => {
        if (results) {
          redis.del(`double:${results.id}`);
        }
      });
      redis.del(`chat_socket: ${manager.id}`);
    }
    let count = getAllClient();
    io.sockets.in("csroom").emit("user_online", count.length);
    io.sockets.in("csroom").emit("csonline", countOnlineManager());
  });

  // 客戶端拿取罐頭訊息
  socket.on("getcanmsg", (roomid, lang) => {
    canmsgfun(roomid, socket.id, lang);
  });
});

// 接收錯誤訊息
process.on("uncaughtException", (err) => {
  console.log(err.stack);
});

function orderroom(socket, roomid, name, detial, linktime, lang) {
  var user = clientJoin(socket.id, name, roomid, detial, linktime, lang, 0);
  request(`http://freeapi.ipip.net/${detial.ip}`, (error, response, body) => {
    if (error == null) {
      let sql = `select id from chat_account_detial where name = ${name}`;
      dbquery(sql).then((result) => {
        if (result == false) {
          let sql1 =
            "insert into chat_account_detial (id, name, ip, area, os, browser, height, width, device, lasttime) value (0, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
          var addsqlparams = [
            name,
            detial.ip,
            body,
            detial.os,
            detial.browser,
            detial.height,
            detial.width,
            detial.device,
            linktime,
          ];
          dbinsert(sql1, addsqlparams);
        } else {
          let sql2 = "update chat_account_detial set area = ? where name = ?";
          let addsqlparams2 = [body, name];
          dbinsert(sql2, addsqlparams2);
        }
      });
      user = clientEditArea(user.id, body);
    }
  });
  var sql3 = "insert into chat_question (id, name, question) value (0, ?, ?)";
  var addsql = [name, detial.qa];
  insertcnt(sql3, addsql);
  io.sockets
    .in("csroom")
    .emit("getRoom", roomid, name, detial, linktime, false);
  canmsgfun(roomid, socket.id, lang).then(() => {
    // 這裡還要做修改
    cs = getRedis();
    setcs(cs, roomid);
    console.log(`${socket.id}已订阅${roomid}`);
    getOnline(roomid);
    let count = checkManagerInRoom(roomid);
    let usercount = getAllClient();
    io.sockets.in(roomid).emit("online", count.length + 1);
    io.sockets.in("csroom").emit("user_online", usercount.length);
    io.socket.in("Chat").emit("getuser", name);
  });
}

// 顯示room的人數
function getOnline(roomid) {
  let count = checkManagerInRoom(roomid);
  let countinroom = count.length + 1;
  io.sockets.in(roomid).emit("online", countinroom);
}

// 從資料庫拿聊天記錄
function getRecord(roomid) {
  return new Promise((resolve) => {
    let sql = `Select count(*) as count from content where room = '${roomid}'`;
    dbquery(sql).then(function (count) {
      if (count[0].count > 50) {
        count = count[0].count - 50;
      } else {
        count = 0;
      }
      let sql = `Select * from content where room = '${roomid}' Limit ${count},50`;
      dbquery(sql).then(function (result) {
        if (result != false) {
          io.sockets.in("csroom").emit("getRecord", result, roomid);
        } else {
          io.sockets.in("csroom").emit("getRecord", null, roomid);
        }
        resolve(true);
      });
    });
  });
}

// 選取cs進入room
function setcs(roomid) {
  let manager = getNoBusyManager();
  if (manager !== false) {
    manager = managerAddRoom(manager.id, roomid);
    getRecord(roomid);
    io.to(manager.id).emit("join", roomid);
    io.sockets
      .in(roomid)
      .emit("msgReceived", "System", { msg: `${manager.name} 加入` }, roomid);
    io.sockets.in(roomid).emit("whichcsinroom", manager.name, roomid);
    io.sockets.in("csroom").emit("cschangestatus", manager.id, 0, manager.name);
    io.to(manager.id).emit("notic_getinroom", roomid);
    // noticbackend(csid, roomid);
    io.sockets.in("csroom").emit("getuserservice", roomid, true);
  } else {
    io.sockets
      .in(roomid)
      .emit("msgReceived", "System", { msg: "客服忙线中，请稍等" }, roomid);
    io.sockets.in("csroom").emit("getuserservice", roomid, false);
  }
}

// function noticbackend(csid, roomid) {
//   if (managerChat.has(csid) && roomName.has(roomid)) {
//     let username = roomName.get(roomid).values().next().value;
//     let chatid = managerChat.get(csid).values().next().value;
//     io.to(chatid).emit("notic_getinroom", username);
//   }
// }

// 取得罐頭訊息
function canmsgfun(roomid, socketid, lang) {
  return new Promise(function (resolve) {
    var sql = `Select msg from chat_sys_msg where lang = ${lang}`;
    dbquery(sql).then(function (msg) {
      io.to(socketid).emit(
        "msgReceived",
        "Canmsg",
        { msg: msg[0].msg },
        roomid
      );
      resolve(true);
    });
  });
}
