const readline = require('readline');
const request = require('superagent');
const jjdecode = require('./jjdecode.js');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const settings = {
	from: {
		id: '',
		name: ''
	},
	to: {
		id: '',
		name: ''
	},
	time_dep: '',
	date: '',
	token: '',
	sessid: '',
	server: '',
	types: [],
	check_interval: 60000
};


const questions = [
	{
		text: 'enter from.name: ',
		set: v=>settings.from.name=v
	},
	{
		text: 'enter from.id: ',
		set: v=>settings.from.id=v
	},
	{
		text: 'enter to.name: ',
		set: v=>settings.to.name=v
	},
	{
		text: 'enter to.id: ',
		set: v=>settings.to.id=v
	},
	{
		text: 'enter date: ',
		set: v=>settings.date=v
	},
	{
		text: 'enter time_dep: ',
		set: v=>settings.time_dep = v || '00:00'
	},
	{
		text: 'enter ticket types (T,T2,T3) : ',
		set: v=>settings.types = v.split(',')
	},
	{
		text: 'enter check interval (sec): ',
		set: v=>settings.check_interval = v * 1000 || 60000
	}
];

function getToken(){
	request.get('http://booking.uz.gov.ua/ru/').end((err, resp)=>{
		if (err) {return false}
		const tmp_sessid = resp.headers['set-cookie'].find(c=>/_gv_sessid/.test(c));
		const tmp_server = resp.headers['set-cookie'].find(c=>/HTTPSERVERID/.test(c));
		let tmp_token = resp.text.match(/\$\$\_\=\~\[\].+\"\\\"\"\)\(\)\)\(\)/);
		tmp_token = tmp_token && jjdecode(tmp_token[0]);
		settings.sessid = tmp_sessid && tmp_sessid.match(/_gv_sessid=(.+);/)[1];
		settings.server = tmp_server && tmp_server.match(/HTTPSERVERID=(.+);/)[1];
		settings.token = tmp_token = tmp_token && tmp_token.match(/, "(.+)"/)[1];
		console.log('settings updated', settings);
		check();
	});
}

function check() {
	if (!settings.token || !settings.server || !settings.sessid) {
		return getToken();
	}
	request.post('http://booking.uz.gov.ua/ru/purchase/search/')
	.type('form')
	.set('GV-Token', settings.token)
	.set('Cookie', `_gv_lang=ru; _gv_sessid=${settings.sessid}; HTTPSERVERID=${settings.server}`)
	.set('GV-Screen', '1920x1080')
	.set('GV-Referer', 'http://booking.uz.gov.ua/ru/')
	.set('GV-Ajax', '1')
	.send({ 
		another_ec: 0,
		date_dep: settings.date,
		station_from: settings.from.name,
		station_id_from: settings.from.id,
		station_till: settings.to.name,
		station_id_till: settings.to.id,
		time_dep: settings.time_dep,
		time_dep_till: '',
		search: ''
	})
	.end((err, resp) => {
		if(err) {
			settings.token ='';
			settings.server='';
			settings.sessid='';
			return;
		}
		check_ticket(resp.body);
	})
}

function check_ticket(data){
	if (data.error) {
			return console.log(data.value);
	}
	if (!data.value.length) {
		return console.log('no tickets avaliable')
	}
	const avaliable = data.value.filter(c=>c.types.reduce((p, c)=>p || ~settings.types.indexOf(c.letter), false))
	console.log(avaliable);
}

const ask_question = ((onEnd)=>{
	let i = 0;
	return ()=>{
		const question = questions[i];
		rl.question(question.text, v=>{
			question.set(v);
			if (++i < questions.length) {
				ask_question();
			} else {
				onEnd();
			}
		});
	}
})(
	()=>{
		rl.close();
		setInterval(check, settings.check_interval);
		check();
	}
);

ask_question();
