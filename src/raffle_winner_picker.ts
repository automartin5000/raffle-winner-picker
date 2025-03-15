import * as fs from 'fs';
import * as readline from 'readline';
import * as csv from 'csv-parser';

interface FinalCounts {
  [prize: string]: { [person: string]: number };
}

interface Winners {
  [prize: string]: string;
}

function pickWinner() {
  const selectionBag: { [prize: string]: string[] } = {};
  const finalCounts: FinalCounts = {};
  const winners: Winners = {};

  fs.createReadStream('raffle_tickets.csv')
    .pipe(csv())
    .on('data', (row) => {
      const prizeName = row['Item Name'];
      const nameOfPerson = row['Donor Name'];
      const quantity = parseInt(row.Quantity, 10);

      if (!selectionBag[prizeName]) {
        selectionBag[prizeName] = [];
        finalCounts[prizeName] = {};
      }
      for (let i = 0; i < quantity; i++) {
        selectionBag[prizeName].push(nameOfPerson);
      }
      if (!finalCounts[prizeName][nameOfPerson]) {
        finalCounts[prizeName][nameOfPerson] = 0;
      }
      finalCounts[prizeName][nameOfPerson] += quantity;
    })
    .on('end', () => {
      for (const prize in finalCounts) {
        console.log(`The following people have purchased tickets for the ${prize} prize:`);
        for (const person in finalCounts[prize]) {
          console.log(`${person} has purchased ${finalCounts[prize][person]} tickets`);
        }
        const winnerIndex = Math.floor(Math.random() * selectionBag[prize].length);
        winners[prize] = selectionBag[prize][winnerIndex];
        console.log(`The winner of the ${prize} prize is ${winners[prize]}`);
      }

      console.log(winners);
      exportFullAuditToCsv(finalCounts);
      exportWinnersToFile(winners);
    });
}

const exportFullAuditToCsv = (finalCounts: FinalCounts) => {
  const writer = fs.createWriteStream('raffle_audit.csv');
  writer.write('Prize,Person,Ticket Count\n');
  for (const prize in finalCounts) {
    for (const person in finalCounts[prize]) {
      writer.write(`${prize},${person},${finalCounts[prize][person]}\n`);
    }
  }
  writer.end();
};

const exportWinnersToFile = (winners: Winners) => {
  const writer = fs.createWriteStream('raffle_winners.csv');
  writer.write('Prize,Winner\n');
  for (const prize in winners) {
    writer.write(`${prize},${winners[prize]}\n`);
  }
  writer.end();
};

pickWinner();