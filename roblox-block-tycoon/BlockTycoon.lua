--[[
  ==========================================
            B L O C K   T Y C O O N
  ==========================================
  How to play it:
    1. Open Roblox Studio -> New -> Baseplate
    2. In the Explorer, find ServerScriptService
    3. Click the + next to it -> Script
    4. Delete what is in the Script, paste ALL of this in
    5. Press Play!

  Step on the yellow pad to claim your tycoon.
  Ore drops on the belt, the furnace turns it into cash.
  Walk on the green buttons to buy upgrades.
]]

local Players = game:GetService("Players")
local Debris = game:GetService("Debris")

local ORIGIN = Vector3.new(0, 0, 40)

local GRASS = Color3.fromRGB(95, 159, 53)
local STONE = Color3.fromRGB(125, 125, 125)
local COBBLE = Color3.fromRGB(85, 85, 85)
local PLANK = Color3.fromRGB(170, 135, 80)
local LOG = Color3.fromRGB(100, 75, 45)
local YELLOW = Color3.fromRGB(255, 230, 60)

local tycoon = Instance.new("Folder")
tycoon.Name = "BlockTycoon"
tycoon.Parent = workspace

local owner = nil
local multiplier = 1
local tips = {} -- player -> tip label in their menu

---------------------------------------------------------------- helpers

local function block(name, size, offset, color, material)
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.Position = ORIGIN + offset
	p.Anchored = true
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Parent = tycoon
	return p
end

local function sign(part, text, color, height)
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.new(0, 220, 0, 50)
	gui.StudsOffset = Vector3.new(0, height or 3, 0)
	gui.MaxDistance = 90
	gui.Parent = part
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Font = Enum.Font.Arcade
	label.TextScaled = true
	label.TextColor3 = color or Color3.new(1, 1, 1)
	label.TextStrokeTransparency = 0
	label.Text = text
	label.Parent = gui
	return label
end

local function setTip(text)
	if owner and tips[owner] then
		tips[owner].Text = text
	end
end

---------------------------------------------------------------- the world

-- grass floor (10 x 10 blocks, each a slightly different green)
for i = 0, 9 do
	for j = 0, 9 do
		local s = math.random(-14, 14)
		block("Grass", Vector3.new(4, 1, 4), Vector3.new(-18 + i * 4, 0.5, -18 + j * 4),
			Color3.fromRGB(95 + s, 159 + s, 53 + s))
	end
end

-- conveyor belt
local belt = block("Conveyor", Vector3.new(26, 1, 4), Vector3.new(-1, 1.5, 0),
	Color3.fromRGB(60, 60, 60), Enum.Material.DiamondPlate)
belt.AssemblyLinearVelocity = Vector3.new(10, 0, 0)
block("Rail", Vector3.new(26, 1.5, 0.5), Vector3.new(-1, 2.75, 2.25), STONE, Enum.Material.Slate)
block("Rail", Vector3.new(26, 1.5, 0.5), Vector3.new(-1, 2.75, -2.25), STONE, Enum.Material.Slate)

-- furnace (turns ore into cash)
local furnace = block("Furnace", Vector3.new(6, 0.8, 6), Vector3.new(15, 1.4, 0), COBBLE, Enum.Material.Cobblestone)
block("FurnaceWall", Vector3.new(1, 5, 6), Vector3.new(18.5, 3.5, 0), COBBLE, Enum.Material.Cobblestone)
local fire = Instance.new("Fire")
fire.Size = 5
fire.Parent = furnace
sign(furnace, "FURNACE", Color3.fromRGB(255, 150, 50), 5)

furnace.Touched:Connect(function(hit)
	if hit.Name == "Ore" and not hit:GetAttribute("Sold") then
		hit:SetAttribute("Sold", true)
		if owner and owner.Parent then
			owner.leaderstats.Cash.Value += hit:GetAttribute("Value") * multiplier
		end
		hit:Destroy()
	end
end)

---------------------------------------------------------------- droppers

local function makeDropper(name, x, oreColor, oreMaterial, value)
	local box = block(name, Vector3.new(4, 4, 4), Vector3.new(x, 9, 0), STONE, Enum.Material.Slate)
	block(name .. "Pipe", Vector3.new(2, 3, 2), Vector3.new(x, 5.5, 0), Color3.fromRGB(70, 70, 70), Enum.Material.Metal)
	sign(box, name .. " ($" .. value .. ")", Color3.new(1, 1, 1), 3.5)

	task.spawn(function()
		while box.Parent do
			if owner then
				local ore = Instance.new("Part")
				ore.Name = "Ore"
				ore.Size = Vector3.new(1.5, 1.5, 1.5)
				ore.Color = oreColor
				ore.Material = oreMaterial
				ore.Position = ORIGIN + Vector3.new(x, 3, 0)
				ore:SetAttribute("Value", value)
				ore.Parent = tycoon
				Debris:AddItem(ore, 20)
			end
			task.wait(2)
		end
	end)
end

-- you start with a coal dropper
makeDropper("Coal", -10, Color3.fromRGB(30, 30, 30), Enum.Material.Slate, 2)

---------------------------------------------------------------- house (the big prize)

local function buildHouse()
	for cx = -6, 6, 4 do
		for cz = 8, 16, 4 do
			local edge = cx == -6 or cx == 6 or cz == 8 or cz == 16
			local corner = (cx == -6 or cx == 6) and (cz == 8 or cz == 16)
			for h = 0, 1 do
				local isDoor = cx == -2 and cz == 8
				if edge and not isDoor then
					local pos = Vector3.new(cx, 3 + h * 4, cz)
					if cx == 2 and cz == 8 and h == 1 then
						local glass = block("Window", Vector3.new(4, 4, 4), pos, Color3.fromRGB(170, 220, 255), Enum.Material.Glass)
						glass.Transparency = 0.5
					elseif corner then
						block("Log", Vector3.new(4, 4, 4), pos, LOG, Enum.Material.Wood)
					else
						block("Plank", Vector3.new(4, 4, 4), pos, PLANK, Enum.Material.WoodPlanks)
					end
				end
			end
			block("Roof", Vector3.new(4, 4, 4), Vector3.new(cx, 11, cz), COBBLE, Enum.Material.Cobblestone)
		end
	end
end

---------------------------------------------------------------- buy buttons

local function makeButton(text, price, x, onBuy)
	local btn = block("Button", Vector3.new(3, 0.4, 3), Vector3.new(x, 1.2, -9),
		Color3.fromRGB(80, 210, 80), Enum.Material.Neon)
	sign(btn, text .. "  $" .. price, YELLOW, 2.5)

	local busy = false
	btn.Touched:Connect(function(hit)
		if busy then return end
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player or player ~= owner then return end
		local cash = player.leaderstats.Cash
		busy = true
		if cash.Value >= price then
			cash.Value -= price
			btn:Destroy()
			onBuy()
		else
			btn.Color = Color3.fromRGB(220, 60, 60) -- not enough cash!
			task.delay(0.6, function()
				if btn.Parent then
					btn.Color = Color3.fromRGB(80, 210, 80)
				end
				busy = false
			end)
		end
	end)
end

makeButton("Iron Dropper", 20, -12, function()
	makeDropper("Iron", -4, Color3.fromRGB(215, 190, 160), Enum.Material.Metal, 5)
	setTip("Iron! Save up for Gold!")
end)

makeButton("Gold Dropper", 80, -6, function()
	makeDropper("Gold", 2, Color3.fromRGB(255, 205, 40), Enum.Material.Metal, 12)
	setTip("Shiny gold! Try the Super Furnace!")
end)

makeButton("Super Furnace x2", 200, 0, function()
	multiplier = 2
	fire.Size = 10
	fire.Color = Color3.fromRGB(80, 160, 255)
	setTip("Everything is worth DOUBLE now!")
end)

makeButton("Diamond Dropper", 400, 6, function()
	makeDropper("Diamond", 8, Color3.fromRGB(90, 235, 230), Enum.Material.Glass, 30)
	setTip("DIAMONDS! Now buy the house!")
end)

makeButton("Block House", 1000, 12, function()
	buildHouse()
	setTip("YOU WIN! Go explore your house!")
end)

---------------------------------------------------------------- claim pad

local pad = block("ClaimPad", Vector3.new(6, 0.2, 6), Vector3.new(0, 1.1, -15), YELLOW, Enum.Material.Neon)
local padLabel = sign(pad, "STEP HERE TO CLAIM!", YELLOW, 3)

pad.Touched:Connect(function(hit)
	if owner then return end
	local player = Players:GetPlayerFromCharacter(hit.Parent)
	if player then
		owner = player
		padLabel.Text = player.DisplayName .. "'s TYCOON"
		pad.Color = Color3.fromRGB(80, 200, 255)
		setTip("Walk on green buttons to buy!")
	end
end)

---------------------------------------------------------------- player menu

local function makeMenu(player, cash)
	local gui = Instance.new("ScreenGui")
	gui.Name = "TycoonMenu"
	gui.ResetOnSpawn = false

	local frame = Instance.new("Frame")
	frame.Size = UDim2.new(0, 330, 0, 112)
	frame.Position = UDim2.new(0, 12, 0, 60)
	frame.BackgroundColor3 = Color3.fromRGB(90, 62, 38)
	frame.BorderSizePixel = 0
	frame.Parent = gui

	local stroke = Instance.new("UIStroke")
	stroke.Thickness = 4
	stroke.Color = GRASS
	stroke.Parent = frame

	local function line(y, h, text, color)
		local t = Instance.new("TextLabel")
		t.Size = UDim2.new(1, -16, 0, h)
		t.Position = UDim2.new(0, 8, 0, y)
		t.BackgroundTransparency = 1
		t.Font = Enum.Font.Arcade
		t.TextScaled = true
		t.TextXAlignment = Enum.TextXAlignment.Left
		t.TextColor3 = color
		t.TextStrokeTransparency = 0.5
		t.Text = text
		t.Parent = frame
		return t
	end

	line(6, 34, player.DisplayName .. "'s Block Tycoon", Color3.fromRGB(150, 230, 90))
	local cashLabel = line(44, 30, "Cash: $" .. cash.Value, YELLOW)
	tips[player] = line(80, 24, "Step on the yellow pad!", Color3.new(1, 1, 1))

	cash.Changed:Connect(function(v)
		cashLabel.Text = "Cash: $" .. v
	end)

	gui.Parent = player:WaitForChild("PlayerGui")
end

local function onPlayerAdded(player)
	local stats = Instance.new("Folder")
	stats.Name = "leaderstats"
	stats.Parent = player
	local cash = Instance.new("IntValue")
	cash.Name = "Cash"
	cash.Value = 0
	cash.Parent = stats
	makeMenu(player, cash)
end

Players.PlayerAdded:Connect(onPlayerAdded)
for _, p in ipairs(Players:GetPlayers()) do
	task.spawn(onPlayerAdded, p)
end

Players.PlayerRemoving:Connect(function(player)
	tips[player] = nil
	if player == owner then
		owner = nil
		padLabel.Text = "STEP HERE TO CLAIM!"
		pad.Color = YELLOW
	end
end)
