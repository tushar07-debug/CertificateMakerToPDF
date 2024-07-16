const { MongoClient } = require("mongodb");
const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const { jsPDF } = require("jspdf");
const fs = require("fs");
const path = require("path");

const url = "mongodb://localhost:27017";
const client = new MongoClient(url);
const dbName = "certificate_data";
const app = express();
app.use(express.static('uploads'))


app.use('/source', express.static(path.join(__dirname, 'source')));
// Assuming certificate.jpeg is in the 'source' directory
const imagePath = `${__dirname}/source/certificate.jpg`;  // Updated path

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./uploads");
  },
  filename: function (req, file, cb) {
    const fileUploadName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, fileUploadName + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

async function insertdata(filePath, Data) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("data");
    const result = { ...Data, fileUpload: filePath };
    await collection.insertOne(result);
    console.log("success");
  } catch (error) {
    console.error(error);
  } finally {
    await client.close();
  }
}

app.post("/savedata", upload.single("photo"), async function (req, res) {
  try {
    const filepath = req.file.path;
    const Data = req.body;
    await insertdata(filepath, Data);
    res.send("Form Uploaded");
  } catch (error) {
    console.log("error");
    res.status(500).send("Error uploading form");
  }
});

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/templates/certificate.html");
});

app.get("/createCertificate/:Sn", async function (req, res) {
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection("data");
    const certificate = await collection.findOne({ Sn: req.params.Sn });

    if (!certificate) {
      return res.status(404).send("Certificate not found");
    }

    const {
      Sn,
      name,
      fname,
      mname,
      dob,
      rollno,
      erollno,
      Session,
      curriculum,
      performance,
      award,
      subject = [],
      theory = [],
      practical = [],
      obtained = [],
      Grade,
      IssueDay,
      IssueYear,
      fileUpload
    } = certificate;

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });

    // const pageWidth = doc.internal.pageSize.getWidth();
    // const pageHeight = doc.internal.pageSize.getHeight();
    // doc.addImage(imagePath, 'JPEG', 0, 0, pageWidth, pageHeight);
    console.log("Image Path:", fileUpload);
    const buffer = fs.readFileSync(fileUpload);
    const base64String = buffer.toString('base64');

    const dataType = 'image/jpeg';
    const dataUrl = `data:${dataType};base64,${base64String}`;

    doc.addImage(dataUrl, "JPEG", 440, 80, 100, 80);
    // Add certificate details to the PDF
    doc.setFontSize(14);

    // Coordinates for each field
    doc.text(`${Sn}`, 40, 70);
    doc.text(`${name}`, 220, 180);
    doc.text(`${fname}`, 220, 205);
    doc.text(`${mname}`, 220, 230);
    doc.text(`${dob}`, 440, 230);
    doc.text(`${rollno}`, 145, 260);
    doc.text(`${erollno}`, 330, 260);
    doc.text(`${Session}`, 440, 260);
    doc.text(`${curriculum}`, 220, 280);
    doc.text(`${performance}`, 345, 340);
    
    doc.setFont("helvetica", "bold");
    doc.text(`${award}`, 300, 420, null, null, "center");;

    // Table Headers
    doc.setFontSize(11);
    const tableStartY = 460;

    // Draw border for the table headers
    doc.rect(40, tableStartY, 515, 15);
    doc.setFont("helvetica", "bold");
    doc.text("S.N.", 50, tableStartY + 10);
    doc.text("Subject", 90, tableStartY + 10);
    doc.text("Max. Marks", 260, tableStartY + 10);
    doc.text("Theory", 340, tableStartY + 10);
    doc.text("Practical", 420, tableStartY + 10);
    doc.text("Obtained", 500, tableStartY + 10);

    // Table Data
    const maxRows = 6;
    let totalTheory = 0;
    let totalPractical = 0;
    let totalObtained = 0;
    let maxMarks=0;
    doc.setFont("times", "normal");
    for (let i = 0; i < maxRows; i++) {
      const rowY = tableStartY + 15 + i * 15;

      // Draw border for each row
      doc.rect(40, rowY, 515, 15);
      if(subject[i]!==undefined){
        doc.text(`${i + 1}`, 50, rowY + 10);
        doc.text(`${subject[i] || ""}`, 90, rowY + 10);
        doc.text(`100`, 260, rowY + 10);
        doc.text(`${theory[i] || ""}`, 340, rowY + 10);
        doc.text(`${practical[i] || ""}`, 420, rowY + 10);
        doc.text(`${obtained[i] || ""}`, 500, rowY + 10);

        maxMarks += 100;
        totalTheory += theory[i] ? parseInt(theory[i], 10) : 0;
        totalPractical += practical[i] ? parseInt(practical[i], 10) : 0;
        totalObtained += obtained[i] ? parseInt(obtained[i], 10) : 0;
      }
      
    }

    // Add total row
    const totalRowY = tableStartY + 15 + maxRows * 15;
    doc.rect(40, totalRowY, 515, 15);

    doc.text("Total", 90, totalRowY + 10);
    doc.text(`${maxMarks}`, 260, totalRowY + 10);
    doc.text(`${totalTheory}`, 340, totalRowY + 10);
    doc.text(`${totalPractical}`, 420, totalRowY + 10);
    doc.text(`${totalObtained}`, 500, totalRowY + 10);

    doc.setFontSize(16);
    doc.text(`${Grade}`, 240, 610);
    doc.text(`${IssueDay}`, 210, 640);
    doc.text(`${IssueYear}`, 380, 640);

    const pdfPath = `./uploads/certificate_${Sn}.pdf`;
    // doc.autoPrint();
    doc.save(pdfPath);  
    res.sendFile(__dirname+`/uploads/certificate_${Sn}.pdf`, (err) => {
      if (err) {
        console.error(err);
        res.status(500).send("Error downloading the file");
      }
      fs.unlinkSync(pdfPath);
    });

    
    // res.download(pdfPath, `certificate_${Sn}.pdf`, (err) => {
    //   if (err) {
    //     console.error(err);
    //     res.status(500).send("Error downloading the file");
    //   }
    //   fs.unlinkSync(pdfPath);
    // });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  } finally {
    await client.close();
  }
});

// app.get("/createCertificate/:Sn", async function (req, res) {
//   try {
//     await client.connect();
//     const db = client.db(dbName);
//     const collection = db.collection("data");
//     const certificate = await collection.findOne({ Sn: req.params.Sn });

//     if (!certificate) {
//       return res.status(404).send("Certificate not found");
//     }

//     const {
//       Sn,
//       name,
//       fname,
//       mname,
//       dob,
//       rollno,
//       erollno,
//       Session,
//       curriculum,
//       performance,
//       award,
//       subject,
//       theory,
//       practical,
//       obtained,
//       Grade,
//       IssueDay,
//       IssueYear,
//     } = certificate;

//     const doc = new jsPDF({
//       orientation: "portrait",
//       unit: "pt",
//       format: "a4",
//     });

//     // Add background image with adjusted dimensions
//     const pageWidth = doc.internal.pageSize.getWidth();
//     const pageHeight = doc.internal.pageSize.getHeight();
//     doc.addImage(imagePath, 'JPEG', 0, 0, pageWidth, pageHeight);

//     // Add certificate details to the PDF
//     doc.setFontSize(12);

//     // Coordinates for each field
//     doc.text(`${Sn}`, 510, 40);
//     doc.text(`${name}`, 220, 190);
//     doc.text(`${fname}`, 220, 215);
//     doc.text(`${mname}`, 220, 240);
//     doc.text(`${dob}`, 440, 240);
//     doc.text(`${rollno}`, 145, 270);
//     doc.text(`${erollno}`, 330, 270);
//     doc.text(`${Session}`, 440, 270);
//     doc.text(`${curriculum}`, 220, 295);
//     doc.text(`${performance}`, 345, 355);
//     doc.text(`${award}`, 145, 440);
//     doc.text(`${Grade}`, 165, 640);
//     doc.text(`${IssueDay}`, 285, 680);
//     doc.text(`${IssueYear}`, 360, 680);

//     // Table Headers
//     doc.setFontSize(10);
//     const tableStartY = 480;

//     // Draw border for the table headers
//     doc.rect(40, tableStartY, 515, 15);

//     doc.text("S.N.", 50, tableStartY + 10);
//     doc.text("Subject", 90, tableStartY + 10);
//     doc.text("Max. Marks", 260, tableStartY + 10);
//     doc.text("Theory", 340, tableStartY + 10);
//     doc.text("Practical", 420, tableStartY + 10);
//     doc.text("Obtained", 500, tableStartY + 10);

//     // Table Data
//     subject.forEach((subj, index) => {
//       const rowY = tableStartY + 15 + index * 15;

//       // Draw border for each row
//       doc.rect(40, rowY, 515, 15);

//       doc.text(`${index + 1}`, 50, rowY + 10);
//       doc.text(`${subj}`, 90, rowY + 10);
//       doc.text(`100`, 260, rowY + 10);
//       doc.text(`${theory[index] || ""}`, 340, rowY + 10);
//       doc.text(`${practical[index] || ""}`, 420, rowY + 10);
//       doc.text(`${obtained[index] || ""}`, 500, rowY + 10);
//     });

//     const pdfPath = `./uploads/certificate_${Sn}.pdf`;
//     doc.save(pdfPath);

//     res.download(pdfPath, `certificate_${Sn}.pdf`, (err) => {
//       if (err) {
//         console.error(err);
//         res.status(500).send("Error downloading the file");
//       }
//       fs.unlinkSync(pdfPath);
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Server Error");
//   } finally {
//     await client.close();
//   }
// });

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
