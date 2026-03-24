const { jsPDF } = require("jspdf");
const doc = new jsPDF();
doc.text("Hello world!", 10, 10);
const data = doc.output();
console.log("PDF generated successfully, length:", data.length);
