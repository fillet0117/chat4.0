const managers = [];

// 客戶端的資料
/*
id: socket.id
name: 暱稱
accid: account id
rooms: 在那些room裡
status: disc(離線), manu(手動), auto(自動)
accountcode: 帳號
*/
function managerJoin(id, name, accid, rooms, status, accountcode) {
  const manager = { id, name, accid, rooms, status, accountcode };
  managers.push(manager);
  return manager;
}

// 取得現在客戶的資料
function getCurrentManager(id) {
  let manager = managers.find((manager) => manager.id === id);
  if (manager === undefined) {
    return false;
  } else {
    return manager;
  }
}

// 客戶離開
function managerLeave(id) {
  const index = managers.findIndex((manager) => manager.id === id);
  if (index != -1) {
    const manager = managers.splice(index, 1)[0];
    return manager;
  } else {
    return false;
  }
}

// 取得所有的client
function getAllManager() {
  return managers;
}

// 判斷client是否存在
function managerExist(id) {
  const index = managers.findIndex((manager) => manager.id === id);
  if (index != -1) {
    return index;
  } else {
    return false;
  }
}

// 修改manager的status
function managerEditStatus(id, status) {
  const index = managers.findIndex((manager) => manager.id === id);
  if (index !== -1) {
    managers[index].status = status;
    return managers[index];
  }
}

// 把room加到manager rooms裡面
function managerAddRoom(id, room) {
  const index = managers.findIndex((manager) => manager.id === id);
  if (index !== -1 && managers[index].rooms.indexOf(room) === -1) {
    managers[index].rooms.push(room);
    return managers[index];
  }
}

// 把room從rooms中刪除
function managerDeleteRoom(id, room) {
  const index = managers.findIndex((manager) => manager.id === id);
  const roomindex = managers[index].rooms.indexOf(room);
  if (index !== -1 && roomindex !== -1) {
    managers[index].rooms.splice(roomindex, 1);
    return managers[index];
  }
}

// 查看rooms中是否有roomid
function checkManagerInRoom(roomid) {
  let ary = [];
  managers.forEach((value) => {
    if (value.rooms.indexOf(roomid) !== -1) {
      ary.push(value);
    }
  });
  return ary;
}

// 取得manager的數量
function countOnlineManager() {
  let count = managers.length;
  let discmanager = managers.filter((manager) => manager.status === "disc");
  let disccount = discmanager.length;
  return count - disccount;
}

// 取得閒置的manager
function getNoBusyManager() {
  let index = managers.findIndex((manager) => manager.rooms.length === 0);
  console.log(index);
  if (index !== -1) {
    return managers[index];
  } else {
    return false;
  }
}

module.exports = {
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
};
