let express = require('express');
let router = express.Router();
let mysql = require('../config/mysql');

router.get('/', function (req, res, next) {
  mysql.query("SELECT * FROM students", function (err, result) {
    if (err) console.error(err);
    else res.send(result);
  });
});
// DOES NOT CHECK GRAD AND UNGRAD
router.post('/register/add',function(req,res){
  let checksql = "SELECT * FROM sections NATURAL JOIN register \
          WHERE course_id = ? AND\
                section_id = ? AND\
                year = ? AND\
                semester = ? ; ";
  let sql = "INSERT INTO register (`course_id`,`section_id`,`year`,`semester`,`student_id`,`grade`)\
     VALUES (?, ?, ?, ?,?, '-') ";              
  
  mysql.query('SELECT * FROM register WHERE course_id = ? AND year = ? AND semester = ? AND student_id = ?', [
    req.body.course_id, req.body.year, req.body.semester, req.session.userID
  ], (err, result) => {
    if(result.length > 0) res.send('EXIST');
    else {
      mysql.query(checksql, [req.body.course_id, req.body.section_id, req.body.year, req.body.semester], function (err, result) {
        if (err) console.log("CHECK ERROR");
        else if (result.length && result[0].capacity <= result.length) res.send("SECTION FULL");
        else {
          mysql.query(sql, [req.body.course_id, req.body.section_id, req.body.year, req.body.semester, req.session.userID], function (err, result) {
            if (req.session.userType === 'student') {
              console.log(err)
              if (err) res.send("FAIL");
              else {
                console.log(result);
                res.send("OK");
              }
            }
            else res.send("FAIL NOT STUDENT");
          });
        }
      });
    }
  });
});

router.post('/request', function(req, res, next){
  if(!req.session.isLogin || req.session.userType != 'student') res.send('FAIL');
  else{
    let query = `INSERT INTO requests (student_id, type) VALUES ('${req.session.userID.toString()}', '${req.body.type}')`
    mysql.query(query, function(err, result){
      if(err) return res.send(err);
      else return res.send('OK');
    });
  }
});

router.get('/payment', function(req, res, next){
  if(!req.session.isLogin || req.session.userType != 'student') res.send('FAIL');
  else{
    let student_id = req.session.userID.toString();
    let query = 'SELECT * FROM pay NATURAL JOIN fees WHERE student_id = "' + student_id + '"';
    mysql.query(query, (err, result) => {
      if(err) return res.send({});
      return res.send({
        fees: result,
      });
    });
  }
});

router.post('/register/withdraw', function(req, res, next){
  if(!req.session.isLogin || req.session.userType != 'student') res.send('FAIL');
  else{
    let course_id = req.body.course_id;
    let section_id = req.body.section_id;
    let year = req.body.year;
    let semester = req.body.semester;
    let student_id = req.session.userID;
    let query = `UPDATE register SET grade = 'W' WHERE course_id='${course_id}' AND section_id='${section_id}'\
    AND year=${year} AND semester='${semester}' AND student_id='${student_id}'`;
    mysql.query(query, function(err, result){
      if(err) return res.send('FAIL');
      else{
        return res.send('OK')
      }
    });
  }
});

router.post('/register/remove', function(req, res, next){
  if(!req.session.isLogin || req.session.userType != 'student') res.send('FAIL');
  else{
    let course_id = req.body.course_id;
    let section_id = req.body.section_id;
    let year = req.body.year;
    let semester = req.body.semester;
    let student_id = req.session.userID;
    console.log(student_id);
    let query1 = `SELECT * FROM undergrad_students WHERE student_id = '${student_id}'`;
    mysql.query(query1, function(err, result1){
      if(err){
        console.log('NOT IN UNDERGRAD STUDENTS');
        return res.send('FAIL');
      }
      else{
        let query2 = `DELETE FROM database_project.register WHERE course_id='${course_id}' \
        AND section_id='${section_id}' AND year='${year}' AND semester='${semester}' AND student_id='${student_id}'`;
        mysql.query(query2, function(err, result2){
          if(err){
            console.log('UNABLE TO REMOVE REGISTERED COURSE');
            return res.send('FAIL');
          }
          else return res.send('OK');
        });
      }
    });
  }
});

//DOES NOT CHECK RAD OR UNDER GRAD
router.get('/course/all',function(req,res){

  const student_id = req.session.userID;
  const query = 'SELECT * FROM (register NATURAL JOIN (sections NATURAL JOIN time_slots)) NATURAL JOIN courses WHERE student_id = "' + student_id + '"';

  const promise = new Promise((resolve, reject) => {
    mysql.query(query, function (err, timeSlots) {
      if (err) reject(err);
      else resolve(timeSlots);
    });
  });

  let courses = [];

  promise.then(timeSlots => {

    timeSlots.map(timeSlot => {

      let course = courses.find((course) => course.course_id === timeSlot.course_id);
      if (course === undefined) {
        course = {
          course_id: timeSlot.course_id,
          name: timeSlot.name,
          credit: timeSlot.credit,
          faculty_id: timeSlot.faculty_id,
          sections: [],
        };
        courses.push(course);
      }

      let section = course.sections.find(section => section.section_id === timeSlot.section_id);
      if (section === undefined) {
        section = {
          section_id: timeSlot.section_id,
          year: timeSlot.year,
          semester: timeSlot.semester,
          capacity: timeSlot.capacity,
          building_id: timeSlot.building_id,
          room_id: timeSlot.room_id,
          grade: timeSlot.grade,
          time_slots: []
        };
        course.sections.push(section);
      }

      section.time_slots.push({
        slot_order: timeSlot.slot_order,
        day: timeSlot.day,
        start_time: timeSlot.start_time,
        end_time: timeSlot.end_time,
      });
    });

    res.send({ courses: courses });
  }).catch(err => {
    console.log(err);
    res.send({});
  });
});

router.get('/request',function(req,res){
  if(req.session.userType === 'student'){
    let userID = req.session.userID;
    let sql = `SELECT * FROM requests WHERE student_id = '${userID}'`
    let result = [];
    mysql.query(sql,function(err,requests){
      if (err) res.send({});
      else{
        requests.map((request,index) =>{
          result.push(request);
          console.log(requests.length-1);
          if(index === requests.length-1) {
            console.log("OK");
            res.send({'requests' : result});
          }
        });
      }
    });
  }
  else res.send({});
});


// Result: 
// {requests: request (array of object)}
module.exports = router;
