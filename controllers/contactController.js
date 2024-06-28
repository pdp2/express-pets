const sanitizeHtml = require("sanitize-html");
const { ObjectId } = require("mongodb");
const petsCollection = require("../db").db().collection("pets");
const contactsCollection = require("../db").db().collection("contacts");
const nodemailer = require("nodemailer");
const validator = require("validator");

const sanitizeOptions = {
  allowedTags: [],
  allowedAttributes: {}
};

exports.submitContact = async function(req, res, next) {
  if (req.body.secret.toUpperCase() !== "PUPPY") {
    console.log("Spam detected!");
    return res.json({message: "Spam detected!"})
  }

  if (typeof req.body.name !== "string") {
    req.body.name = "";
  }

  if (typeof req.body.email !== "string") {
    req.body.email = "";
  }

  if (typeof req.body.comment !== "string") {
    req.body.comment = "";
  }

  if (!validator.isEmail(req.body.email)) {
    console.log("Invalid email");
    return res.json({message: "Invalid email"})
  }

  if (!ObjectId.isValid(req.body.petId)) {
    console.log("Invalid ID");
    return res.json({message: "Invalid ID"})
  }

  const petId = new ObjectId(req.body.petId);
  const doesPetExist = await petsCollection.findOne({_id: new ObjectId(petId)});

  if (!doesPetExist) {
    console.log("Pet does not exist");
    return res.json({message: "Pet does not exist"})
  }

  const ourObject = {
    petId,
    name: sanitizeHtml(req.body.name, sanitizeOptions),
    email: sanitizeHtml(req.body.email, sanitizeOptions),
    comment: sanitizeHtml(req.body.comment, sanitizeOptions),
  };

  console.log(ourObject);

  const transport = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: process.env.MAILTRAPUSERNAME,
      pass: process.env.MAILTRAPPASSWORD
    }
  });

  try {
    const promise1 = transport.sendMail({
      to: ourObject.email,
      from: "petadoption@localhost",
      subject: `Thank you for your interest in ${doesPetExist.name}`,
      html: `
        <h3 style="color: purple; font-size: 30px;">Thank you</h3>
        <p>We will get back to you as soon as possible!</p>
        <p><em>${ourObject.comment}</em></p>
      `
    });
  
    const promise2 = transport.sendMail({
      to: "petadoption@localhost",
      from: "petadoption@localhost",
      subject: `Someone is interested in ${doesPetExist.name}`,
      html: `
        <h3 style="color: purple; font-size: 30px;">New contact</h3>
        <p>Name: ${ourObject.name}</p>
        <p>Pet interested in: ${doesPetExist.name}</p>
        <p>Email: ${ourObject.email}</p>
        <p>Message: ${ourObject.comment}</p>
      `
    });

    const promise3 = await contactsCollection.insertOne(ourObject);

    await Promise.all([promise1, promise2, promise3]);
  } catch (err) {
    next(err);
  }

  res.send("Thanks for your submission!");
}

exports.viewPetContacts = async function(req, res) {
  if (!ObjectId.isValid(req.params.id)) {
    console.log("Invalid ID");
    res.redirect("/");
  }

  const pet = await petsCollection.findOne({_id: new ObjectId(req.params.id)});

  if (!pet) {
    console.log("Pet does not exist");
    res.redirect("/");
  }

  const contacts = await contactsCollection.find({petId: new ObjectId(req.params.id)}).toArray();
  res.render("pet-contacts", {contacts, pet});
}