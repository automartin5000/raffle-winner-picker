## Given a csv file of a list of people who have purchased raffle tickets for a prize, pick a winner.
## The headers of the CSV include: 
## PaymentID, Donor Name, First Name, Last Name, Email, Date, Item Name, Item Price, Item Fundraising Type, Quantity, Total Item Amount
## The winner is selected by picking a random number between 1 and the total number of tickets purchased.
## The winner is then added to a dictionary of prize names and winners.

import csv
import random

def pick_winner():
    with open('raffle_tickets.csv', 'r') as f:
        reader = csv.reader(f)
        ## We're going to build a selection bag as a dictionary of prize names and a list of people who have purchased tickets for that prize
        selection_bag: dict[str, list[str]]
        selection_bag = {}
        ## Keeping final count of prize names and counts for each person who has purchased tickets for that prize
        final_counts: dict[str, dict[str, int]]
        final_counts = {}
        winners: dict[str, str]
        winners = {}
        for row in reader:
            ## We're going to skip the header row
            if row[0] == 'PaymentID':
                continue
            ## We're going to add the number of tickets purchased to the selection bag and update the final counts
            for i in range(int(row[9])):
                prize_name = row[6]
                name_of_person = row[1]
                if prize_name not in selection_bag:
                    selection_bag[prize_name] = [name_of_person]
                    final_counts[prize_name] = {name_of_person: 1}
                else:
                    if name_of_person not in final_counts[prize_name]:
                        final_counts[prize_name][name_of_person] = 1
                    else:
                        final_counts[prize_name][name_of_person] += 1
                    selection_bag[prize_name].append(name_of_person)
        for prize, persons in final_counts.items():
            ## Audit report
            print(f'The following people have purchased tickets for the {prize} prize:')
            for person, count in persons.items():
                print(f'{person} has purchased {count} tickets')
            ## We're going to pick a winner for each prize
            print((f'Picking a winner for the {prize} prize from the following list of people {selection_bag[prize]}'))
            winner_index = random.randint(1, len(selection_bag[prize]))-1
            winners[prize] = selection_bag[prize][winner_index]
            print(f'The winner of the {prize} prize is {winners[prize]}')
    print(winners)
    export_full_audit_to_csv(final_counts)
    export_winners_to_file(winners)

def export_full_audit_to_csv(final_counts: dict[str, dict[str, int]]):
    with open('raffle_audit.csv', 'w') as f:
        writer = csv.writer(f)
        writer.writerow(['Prize', 'Person', 'Ticket Count'])
        for prize, persons in final_counts.items():
            for person, count in persons.items():
                writer.writerow([prize, person, count])

def export_winners_to_file(winners: dict[str, str]):
    with open('raffle_winners.csv', 'w') as f:
        writer = csv.writer(f)
        writer.writerow(['Prize', 'Winner'])
        for prize, winner in winners.items():
            writer.writerow([prize, winner])

if __name__ == '__main__':           
    pick_winner()