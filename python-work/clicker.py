from guizero import App, Text, PushButton

score = 0

def add_point():
    global score
    score = score + 1
    score_text.value = "Score: " + str(score)

    if score == 30:
        score_text.value = "You win! 🎉"

def reset():
    global score
    score = 0
    score_text.value = "Score: 0"

app = App(title="Click Game", width=300, height=250)

Text(app, text="Click the button as fast as you can!")
score_text = Text(app, text="Score: 0", size=30)
PushButton(app, text="CLICK ME!", command=add_point)
PushButton(app, text="Reset", command=reset)

app.display()

