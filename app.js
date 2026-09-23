// 快適席くじ
// GitHub Pagesだけで動く、サーバー不要版。
// 同じ「抽選番号（round）」なら、どの端末でも同じ席配置になります。

const STUDENTS = [{"no":1,"ac":-2,"usual":-1,"door":2,"front":false},{"no":2,"ac":-2,"usual":-1,"door":1,"front":false},{"no":3,"ac":-2,"usual":-1,"door":2,"front":false},{"no":4,"ac":-1,"usual":-1,"door":1,"front":false},{"no":5,"ac":-1,"usual":0,"door":2,"front":false},{"no":6,"ac":0,"usual":0,"door":1,"front":false},{"no":7,"ac":-1,"usual":0,"door":0,"front":false},{"no":8,"ac":-2,"usual":-1,"door":-1,"front":false},{"no":9,"ac":-2,"usual":-2,"door":1,"front":false},{"no":10,"ac":-1,"usual":0,"door":1,"front":false},{"no":11,"ac":-2,"usual":1,"door":2,"front":true},{"no":12,"ac":-1,"usual":0,"door":-1,"front":false},{"no":13,"ac":1,"usual":2,"door":2,"front":false},{"no":14,"ac":-1,"usual":2,"door":-1,"front":false},{"no":15,"ac":0,"usual":1,"door":1,"front":false},{"no":16,"ac":-2,"usual":-1,"door":1,"front":false},{"no":17,"ac":0,"usual":0,"door":2,"front":false},{"no":18,"ac":-2,"usual":-2,"door":2,"front":false},{"no":19,"ac":-1,"usual":-1,"door":2,"front":true},{"no":20,"ac":0,"usual":0,"door":1,"front":false},{"no":21,"ac":-1,"usual":0,"door":2,"front":false},{"no":22,"ac":-1,"usual":0,"door":-2,"front":false},{"no":23,"ac":-1,"usual":-1,"door":1,"front":true},{"no":24,"ac":0,"usual":1,"door":-2,"front":false},{"no":25,"ac":2,"usual":1,"door":1,"front":false},{"no":26,"ac":0,"usual":0,"door":0,"front":false},{"no":27,"ac":-1,"usual":0,"door":-2,"front":false},{"no":28,"ac":-1,"usual":0,"door":-2,"front":false},{"no":29,"ac":-1,"usual":-1,"door":2,"front":false},{"no":30,"ac":-1,"usual":0,"door":2,"front":true},{"no":31,"ac":-1,"usual":0,"door":1,"front":false},{"no":32,"ac":-1,"usual":-1,"door":-1,"front":false},{"no":33,"ac":-2,"usual":-2,"door":0,"front":false},{"no":34,"ac":-1,"usual":0,"door":2,"front":false},{"no":35,"ac":-1,"usual":0,"door":2,"front":false},{"no":36,"ac":1,"usual":0,"door":-1,"front":true},{"no":37,"ac":-1,"usual":2,"door":1,"front":false},{"no":38,"ac":-2,"usual":0,"door":0,"front":false},{"no":39,"ac":0,"usual":-1,"door":2,"front":false}];

// 次回から空席にする席：F1 / A1 / A7
const BLOCKED = new Set(["F1","A1","A7"]);

// A=窓・エアコン側（寒い）→ F=廊下側（暖かい）の座席温度スコア
const COL_TEMP = {A:-2, B:-1, C:0, D:0.4, E:0.9, F:1.3};

const LETTERS = ["A","B","C","D","E","F"];

function getRound() {
  const params = new URLSearchParams(location.search);
  let r = params.get("round");
  if (!r) {
    r = "1";
    history.replaceState(null,"", "?round=" + r);
  }
  return r;
}

function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  let x = seed >>> 0;
  return function() {
    x += 0x6D2B79F5;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, random) {
  const a = [...arr];
  for(let i=a.length-1;i>0;i--) {
    const j=Math.floor(random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function makeSeats() {
  const seats=[];
  for(let row=1;row<=7;row++) {
    for(const col of LETTERS) {
      const id=col+row;
      if(!BLOCKED.has(id)) seats.push({id,col,row});
    }
  }
  return seats;
}

// ac: -2=寒く感じやすい、+2=暑く感じやすい
// 暑がりほど寒いA側、寒がりほど暖かいF側に行きやすくする。
// usualは普段の温度感で少し補正。
// doorはドア付近への敏感さ。F7は出入りが多いので、気になる人には割り当てない。
function score(student, seat) {
  const target = -(0.8*student.ac + 0.2*student.usual);
  const diff = Math.abs(target - COL_TEMP[seat.col]);
  let s = 100 - 45*diff;

  if(student.front && seat.row>3) return -999999;

  if(seat.id==="F7") {
    if(student.door>=1) return -999999;
    s -= 8;
  }
  return s;
}

function weightedPick(items, scores, random) {
  const max=Math.max(...scores);
  const weights=scores.map(s=>Math.exp((s-max)/12));
  const total=weights.reduce((a,b)=>a+b,0);
  let x=random()*total;
  for(let i=0;i<items.length;i++) {
    x-=weights[i];
    if(x<=0) return items[i];
  }
  return items[items.length-1];
}

function makeAssignment(round) {
  const random=rng(hashSeed("kaiteki-seat-" + round));
  let order=shuffle(STUDENTS,random);

  // 前方希望者は先に配置（1～3行しか選べないため）。
  // その中でも温度差が大きい人から順に処理して、A/Fの偏りをできるだけ吸収。
  order.sort((a,b)=>{
    const pa=a.front?1:0, pb=b.front?1:0;
    if(pa!==pb) return pb-pa;
    const ta=-(0.8*a.ac+0.2*a.usual);
    const tb=-(0.8*b.ac+0.2*b.usual);
    return (tb-ta) + (random()-0.5)*0.5;
  });

  let available=makeSeats();
  const result={};

  for(const student of order) {
    let candidates=available.filter(seat=>score(student,seat)>-999000);

    // F7が空いていて、他に席がある場合、ドアが気になる人には使わない。
    if(student.door>=1 && candidates.length>1) {
      const noDoor=candidates.filter(s=>s.id!=="F7");
      if(noDoor.length) candidates=noDoor;
    }

    const ranked=candidates.map(seat=>({seat, s:score(student,seat)}))
      .sort((a,b)=>b.s-a.s);

    // 上位約55%の席から重み付き抽選。
    // これが「完全固定ではない」Nudge部分。
    const topN=Math.max(1,Math.ceil(ranked.length*0.55));
    const pool=ranked.slice(0,topN);
    const chosen=weightedPick(pool.map(x=>x.seat),pool.map(x=>x.s),random);

    result[student.no]=chosen.id;
    available=available.filter(s=>s.id!==chosen.id);
  }
  return result;
}

const ROUND=getRound();
const ASSIGNMENT=makeAssignment(ROUND);

function showStudent() {
  const input=document.getElementById("numberInput");
  const result=document.getElementById("result");
  const no=Number(input.value);
  const student=STUDENTS.find(s=>s.no===no);

  if(!student) {
    result.classList.remove("hidden");
    result.innerHTML="<strong>出席番号を確認してください。</strong>";
    return;
  }

  const seat=ASSIGNMENT[no];
  result.classList.remove("hidden");
  result.innerHTML=`
    <div class="small">出席番号 ${no} の席</div>
    <div class="seat">${seat}</div>
    <div class="small">抽選番号：${ROUND}</div>
  `;
}

function renderTeacher() {
  document.getElementById("roundText").textContent="抽選番号：" + ROUND;
  document.getElementById("shareUrl").value=location.href;

  const grid=document.getElementById("seatGrid");
  grid.innerHTML="";
  for(let row=1;row<=7;row++) {
    for(const col of LETTERS) {
      const id=col+row;
      const cell=document.createElement("div");
      cell.className="seatCell";
      if(BLOCKED.has(id)) {
        cell.classList.add("empty");
        cell.innerHTML=`<div class="id">${id}</div><div class="person">空席</div>`;
      } else {
        const no=Object.keys(ASSIGNMENT).find(n=>ASSIGNMENT[n]===id);
        if(id==="F7") cell.classList.add("door");
        cell.innerHTML=`<div class="id">${id}</div><div class="person">${no ? "出席 "+no : "—"}</div>`;
      }
      grid.appendChild(cell);
    }
  }

  const tbody=document.getElementById("assignmentTable");
  tbody.innerHTML="";
  [...STUDENTS].sort((a,b)=>a.no-b.no).forEach(s=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${s.no}</td><td><strong>${ASSIGNMENT[s.no]}</strong></td>`;
    tbody.appendChild(tr);
  });
}

document.getElementById("drawBtn").addEventListener("click",showStudent);
document.getElementById("numberInput").addEventListener("keydown",e=>{if(e.key==="Enter")showStudent();});

document.getElementById("teacherBtn").addEventListener("click",()=>{
  const pin=prompt("先生用PINを入力してください。");
  if(pin==="2468") {
    document.getElementById("teacherView").classList.remove("hidden");
    document.getElementById("studentView").classList.add("hidden");
    document.getElementById("teacherBtn").classList.add("hidden");
    renderTeacher();
  } else if(pin!==null) {
    alert("PINが違います。");
  }
});

document.getElementById("newRoundBtn").addEventListener("click",()=>{
  const newRound=String(Date.now());
  const url=new URL(location.href);
  url.searchParams.set("round",newRound);
  location.href=url.toString();
});

document.getElementById("copyBtn").addEventListener("click",async()=>{
  const input=document.getElementById("shareUrl");
  try {
    await navigator.clipboard.writeText(input.value);
    alert("共有リンクをコピーしました！");
  } catch(e) {
    input.select();
    document.execCommand("copy");
    alert("共有リンクをコピーしました！");
  }
});
