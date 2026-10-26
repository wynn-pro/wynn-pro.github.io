from guizero import App, Text, PushButton, Box

score = 0
money = 0
time_left = 15
playing = False

def add_point():
    global score, money
    score = score + 1
    money = money + 5
    score_text.value = "Score: " + str(score)
    money_text.value = "$" + str(money)

def start_game():
    global score, time_left, playing, money
    score = 0
    money = 0
    time_left = 10
    playing = True
    score_text.value = "Score: 0"

    timer_text.value = "Time: 10"
    # click_button.enabled = True
    click_button.visible = True
    start_button.enabled = False
    timer_text.repeat(1000, count_down)

def count_down():
    global time_left
    if playing:
        time_left = time_left - 1
        timer_text.value = "Time: " + str(time_left)
        if time_left == 0:
            end_game()

def end_game():
    global playing, money
    playing = False
    timer_text.cancel(count_down)
    click_button.visible = False
    start_button.enabled = True
    score_text.value = "Final score: " + str(score) + "  You'v earned $" + str(money)
    money = 0
    money_text.value = "$0"


def key_pressed(event):
    if playing and event.key == " ":
        add_point()

app = App(title="Click Game", width=600, height=500
          )
app.when_key_pressed = key_pressed
top_bar = Box(app, width="fill", align="top")
money_text = Text(top_bar, text="$0", size=20, color="green", align="right")

timer_text = Text(app, text="Time: 10", size=20)
score_text = Text(app, text="Score: 0", size=30)
click_button = PushButton(app, text="CLICK ME!", command=add_point, visible=False)
start_button = PushButton(app, text="Start", command=start_game)

app.display()
