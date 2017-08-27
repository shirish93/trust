var PEEP_METADATA = {
	   tft: {frame:0, color:"#4089DD"}, 
	 all_d: {frame:1, color:"#52537F"},
	 all_c: {frame:2, color:"#FF75FF"},
	grudge: {frame:3, color:"#efc701"},
	prober: {frame:4, color:"#f6b24c"},
	  tf2t: {frame:5, color:"#88A8CE"},
	pavlov: {frame:6, color:"#86C448"},
	random: {frame:7, color:"#FF5E5E"}
};

var PD = {};
PD.COOPERATE = "COOPERATE";
PD.CHEAT = "CHEAT";

PD.PAYOFFS_DEFAULT = {
	P: 0, // punishment: neither of you get anything
	S: -1, // sucker: you put in coin, other didn't.
	R: 2, // reward: you both put 1 coin in, both got 3 back
	T: 3 // temptation: you put no coin, got 3 coins anyway
};

PD.PAYOFFS = JSON.parse(JSON.stringify(PD.PAYOFFS_DEFAULT));

subscribe("pd/editPayoffs", function(payoffs){
	PD.PAYOFFS = payoffs;
});
subscribe("pd/editPayoffs/P", function(value){ PD.PAYOFFS.P = value; });
subscribe("pd/editPayoffs/S", function(value){ PD.PAYOFFS.S = value; });
subscribe("pd/editPayoffs/R", function(value){ PD.PAYOFFS.R = value; });
subscribe("pd/editPayoffs/T", function(value){ PD.PAYOFFS.T = value; });
subscribe("pd/defaultPayoffs", function(){

	PD.PAYOFFS = JSON.parse(JSON.stringify(PD.PAYOFFS_DEFAULT));

	publish("pd/editPayoffs/P", [PD.PAYOFFS.P]);
	publish("pd/editPayoffs/S", [PD.PAYOFFS.S]);
	publish("pd/editPayoffs/R", [PD.PAYOFFS.R]);
	publish("pd/editPayoffs/T", [PD.PAYOFFS.T]);

});

PD.NOISE = 0;
subscribe("rules/noise",function(value){
	PD.NOISE = value;
});

PD.getPayoffs = function(move1, move2){
	var payoffs = PD.PAYOFFS;
	if(move1==PD.CHEAT && move2==PD.CHEAT) return [payoffs.P, payoffs.P]; // both punished
	if(move1==PD.COOPERATE && move2==PD.CHEAT) return [payoffs.S, payoffs.T]; // sucker - temptation
	if(move1==PD.CHEAT && move2==PD.COOPERATE) return [payoffs.T, payoffs.S]; // temptation - sucker
	if(move1==PD.COOPERATE && move2==PD.COOPERATE) return [payoffs.R, payoffs.R]; // both rewarded
};

PD.playOneGame = function(playerA, playerB){

	// Make your moves!
	var A = playerA.play();
	var B = playerB.play();
	console.log("Version 9");
	console.log(A);
	var A_mood = playerA.mood_;
	var B_mood = playerB.mood_;
	console.log(A_mood, B_mood);

	// Noise: random mistakes, flip around!
	if(Math.random()<PD.NOISE) A = ((A==PD.COOPERATE) ? PD.CHEAT : PD.COOPERATE);
	if(Math.random()<PD.NOISE) B = ((B==PD.COOPERATE) ? PD.CHEAT : PD.COOPERATE);
	
	// Get payoffs
	var payoffs = PD.getPayoffs(A,B);

	// Remember own & other's moves (or mistakes)
	playerA.remember(A, B_mood);
	playerB.remember(B, A, A_mood);

	// Add to scores (only in tournament?)
	playerA.addPayoff(payoffs[0]);
	playerB.addPayoff(payoffs[1]);

	// Return the payoffs...
	return payoffs;

};

PD.playRepeatedGame = function(playerA, playerB, turns){

	// I've never met you before, let's pretend
	playerA.resetLogic();
	playerB.resetLogic();

	// Play N turns
	var scores = {
		totalA:0,
		totalB:0,
		payoffs:[]
	};
	for(var i=0; i<turns; i++){
		var p = PD.playOneGame(playerA, playerB);
		scores.payoffs.push(p);
		scores.totalA += p[0];
		scores.totalB += p[1];
	}

	// Return the scores...
	return scores;

};

PD.playOneTournament = function(agents, turns){

	// Reset everyone's coins
	for(var i=0; i<agents.length; i++){
		agents[i].resetCoins();
	}

	// Round robin!
	for(var i=0; i<agents.length; i++){
		var playerA = agents[i];
		for(var j=i+1; j<agents.length; j++){
			var playerB = agents[j];
			PD.playRepeatedGame(playerA, playerB, turns);
		}	
	}

};


//
//Extra code added by Shirish Pokharel
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}

Number.prototype.map = function (in_min, in_max, out_min, out_max) {
  return (this - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

function should_change(moodval){
	var res = 0;
	var rand_num = getRandomInt(0, 101);
	if (moodval < 0){
		res = Math.ceil(num.map(.1, 6, 0, 10));
		if (rand_num <= res){
			return PD.CHEAT;
		}
	}
	if (moodval > 0){
		res = Math.ceil(num.map(-10, -.1, 0, 20));
		if (rand_num <= res){
			return PD.COOPERATE;
		}
	}
	return 0;
}


//

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

function Logic_tft(){
	var self = this;
	var mood_ = getRandomInt(-10, 6);
	var happiness_counter = 0;
	var anger_counter = 0;
	var anger_agree = 0;
	var happiness_disagree = 0;
	var anger_influenced = false;
	var happiness_influenced = false;
	var next_move = 0;
	
	var otherMove = PD.COOPERATE;
	
	self.mood = function(){
		return mood_;
	}

	self.play = function(){
		//If we are 5 moves away from having cheated a happy negotiator...
		if (happiness_counter > 4){
			happiness_counter = 0;
			//if they admonished us by disagreeing more than 2/5 times
			if (happiness_disagree > 2){
				//we know not to be influened by the happiness rule anymore
				//because they've discovered we're taking advantage of their
				//happiness.
				happiness_influenced = false;
			}
			happiness_disagree = 0;
		}
		//if we are 6 moves away from capitulating to an angry negotiator
		if (anger_counter > 5){
			anger_counter = 0;
			//if they have not reciprocated at least 2/6 times...
			if (anger_agree < 3){
				//we know they are irrationally crazy, and won't return the
				//favor even if we capitulate. So, ignore the anger rule.
				anger_influenced = false;
			}
			anger_agree = 0;
		}
		
		toReturn = otherMove
		
		if (next_move != 0 && next_move != otherMove && anger_influenced
			&& happiness_influenced){
			return next_move;
		}
		return toReturn;
	};
	self.remember = function(own, other, other_mood){
		next_move = should_change(other_mood);
		otherMove = other;
		if (next_move == PD.CHEAT) happiness_counter++;
		if (next_move == PD.COOPERATE) anger_counter++;

	};
}

function Logic_tf2t(){
	var self = this;
	var mood_ = getRandomInt(-10, 6);
	var happiness_counter = 0;
	var anger_counter = 0;
	var anger_agree = 0;
	var happiness_disagree = 0;
	var anger_influenced = false;
	var happiness_influenced = false;
	var howManyTimesCheated = 0;
	var next_move = 0;

	self.mood = function(){
		return mood_;
	}

	self.play = function(){

		//If we are 5 moves away from having cheated a happy negotiator...
		if (happiness_counter > 4){
			happiness_counter = 0;
			//if they admonished us by disagreeing more than 2/5 times
			if (happiness_disagree > 2){
				//we know not to be influened by the happiness rule anymore
				//because they've discovered we're taking advantage of their
				//happiness.
				happiness_influenced = false;
			}
			happiness_disagree = 0;
		}
		//if we are 6 moves away from capitulating to an angry negotiator
		if (anger_counter > 5){
			anger_counter = 0;
			//if they have not reciprocated at least 2/6 times...
			if (anger_agree < 3){
				//we know they are irrationally crazy, and won't return the
				//favor even if we capitulate. So, ignore the anger rule.
				anger_influenced = false;
			}
			anger_agree = 0;
		}



		var toReturn = 0;
		
		if(howManyTimesCheated>=2){
			toReturn = PD.CHEAT; // retaliate ONLY after two betrayals
		}else{
			toReturn = PD.COOPERATE;
		}
		
		if (next_move != 0 && next_move != toReturn && happiness_influenced
			&& anger_influenced){
			return next_move;
		}		
		return toReturn;
	};
	self.remember = function(own, other, other_mood){
		next_move = should_change(other_mood)
		
		if(other==PD.CHEAT){
			howManyTimesCheated++;
		}else{
			howManyTimesCheated = 0;
		}
		
		if (next_move == PD.CHEAT) happiness_counter++;
		if (next_move == PD.COOPERATE) anger_counter++;

	};
}

function Logic_grudge(){
	var self = this;
	var everCheatedMe = false;
	var mood_ = getRandomInt(-10, 6);
	var happiness_counter = 0;
	var anger_counter = 0;
	var anger_agree = 0;
	var happiness_disagree = 0;
	var anger_influenced = false;
	var happiness_influenced = false;
	var next_move = 0;

	self.mood = function(){
		return mood_;
	}


	self.play = function(){
		//If we are 5 moves away from having cheated a happy negotiator...
		if (happiness_counter > 4){
			happiness_counter = 0;
			//if they admonished us by disagreeing more than 2/5 times
			if (happiness_disagree > 2){
				//we know not to be influened by the happiness rule anymore
				//because they've discovered we're taking advantage of their
				//happiness.
				happiness_influenced = false;
			}
			happiness_disagree = 0;
		}
		//if we are 6 moves away from capitulating to an angry negotiator
		if (anger_counter > 5){
			anger_counter = 0;
			//if they have not reciprocated at least 2/6 times...
			if (anger_agree < 3){
				//we know they are irrationally crazy, and won't return the
				//favor even if we capitulate. So, ignore the anger rule.
				anger_influenced = false;
			}
			anger_agree = 0;
		}
		
		var toReturn = 0;
		if(everCheatedMe){
			toReturn = PD.CHEAT;	
		} 
		else{
			toReturn =  PD.COOPERATE;
		}
		
		if (next_move != 0 && next_move != toReturn && happiness_influenced
			&& anger_influenced){
			return next_move;
		}		
		return toReturn;

	};
	self.remember = function(own, other, other_mood){
		next_move = should_change(other_mood);

		if(other==PD.CHEAT) everCheatedMe=true;
		
		if (next_move == PD.CHEAT) happiness_counter++;
		if (next_move == PD.COOPERATE) anger_counter++;

	};
}

function Logic_all_d(){
	var self = this;
	var mood_ = getRandomInt(-10, 6);
	var happiness_counter = 0;
	var anger_counter = 0;
	var anger_agree = 0;
	var happiness_disagree = 0;
	var anger_influenced = true;
	var happiness_influenced = true;
	var next_move = 0;
	
	
	self.mood = function(){
		return mood_;
	}
	self.play = function(){

		//If we are 5 moves away from having cheated a happy negotiator...
		if (happiness_counter > 4){
			happiness_counter = 0;
			//if they admonished us by disagreeing more than 2/5 times
			if (happiness_disagree > 2){
				//we know not to be influened by the happiness rule anymore
				//because they've discovered we're taking advantage of their
				//happiness.
				happiness_influenced = false;
			}
			happiness_disagree = 0;
		}
		//if we are 6 moves away from capitulating to an angry negotiator
		if (anger_counter > 5){
			anger_counter = 0;
			//if they have not reciprocated at least 2/6 times...
			if (anger_agree < 3){
				//we know they are irrationally crazy, and won't return the
				//favor even if we capitulate. So, ignore the anger rule.
				anger_influenced = false;
			}
			anger_agree = 0;
		}

		var toReturn = PD.CHEAT;
		if (next_move != 0 && next_move != toReturn && happiness_influenced
			&& anger_influenced){
			return next_move;
		}		
		return toReturn;

	};
	self.remember = function(own, other, other_mood){
		// nah
		next_move = should_change(other_mood);
		if (next_move == PD.CHEAT) happiness_counter++;
		if (next_move == PD.COOPERATE) anger_counter++;
		if (happiness_counter > 0 && other == PD.CHEAT){
			happiness_disagree++;
		}
		if (anger_counter > 0 && other == PD.COOPERATE){
			anger_agree++;
		}

	};
}

function Logic_all_c(){
	var self = this;
	var mood_ = getRandomInt(-10, 6);
	var happiness_counter = 0;
	var anger_counter = 0;
	var anger_agree = 0;
	var happiness_disagree = 0;
	var anger_influenced = false;
	var happiness_influenced = false;
	var next_move = 0;
	
	self.mood = function(){
		return mood_;
	}
	self.play = function(){
		//If we are 5 moves away from having cheated a happy negotiator...
		if (happiness_counter > 4){
			happiness_counter = 0;
			//if they admonished us by disagreeing more than 2/5 times
			if (happiness_disagree > 2){
				//we know not to be influened by the happiness rule anymore
				//because they've discovered we're taking advantage of their
				//happiness.
				happiness_influenced = false;
			}
			happiness_disagree = 0;
		}
		//if we are 6 moves away from capitulating to an angry negotiator
		if (anger_counter > 5){
			anger_counter = 0;
			//if they have not reciprocated at least 2/6 times...
			if (anger_agree < 3){
				//we know they are irrationally crazy, and won't return the
				//favor even if we capitulate. So, ignore the anger rule.
				anger_influenced = false;
			}
			anger_agree = 0;
		}

		toReturn = PD.COOPERATE;
		if (next_move != 0 && next_move != toReturn && happiness_influenced
			&& anger_influenced){
			return next_move;
		}		
		return toReturn;

	};
	self.remember = function(own, other, other_mood){
		// nah
		next_move = should_change(other_mood);
		if (next_move == PD.CHEAT) happiness_counter++;
		if (next_move == PD.COOPERATE) anger_counter++;

	};
}

function Logic_random(){
	var self = this;
	var mood_ = getRandomInt(-10, 6);
	var happiness_counter = 0;
	var anger_counter = 0;
	var anger_agree = 0;
	var happiness_disagree = 0;
	var anger_influenced = false;
	var happiness_influenced = false;
	var next_move = 0;
	
	self.mood = function(){
		return mood_;
	}
	self.play = function(){
		//If we are 5 moves away from having cheated a happy negotiator...
		if (happiness_counter > 4){
			happiness_counter = 0;
			//if they admonished us by disagreeing more than 2/5 times
			if (happiness_disagree > 2){
				//we know not to be influened by the happiness rule anymore
				//because they've discovered we're taking advantage of their
				//happiness.
				happiness_influenced = false;
			}
			happiness_disagree = 0;
		}
		//if we are 6 moves away from capitulating to an angry negotiator
		if (anger_counter > 5){
			anger_counter = 0;
			//if they have not reciprocated at least 2/6 times...
			if (anger_agree < 3){
				//we know they are irrationally crazy, and won't return the
				//favor even if we capitulate. So, ignore the anger rule.
				anger_influenced = false;
			}
			anger_agree = 0;
		}
		toReturn =  (Math.random()>0.5 ? PD.COOPERATE : PD.CHEAT);
		if (next_move != 0 && next_move != toReturn && happiness_influenced
			&& anger_influenced){
			return next_move;
		}		
		return toReturn;

	};
	self.remember = function(own, other, other_mood){
		// nah
		next_move = should_change(other_mood);
		if (next_move == PD.CHEAT) happiness_counter++;
		if (next_move == PD.COOPERATE) anger_counter++;

	};
}

// Start off Cooperating
// Then, if opponent cooperated, repeat past move. otherwise, switch.
function Logic_pavlov(){
	var self = this;
	var mood_ = getRandomInt(-10, 6);
	var happiness_counter = 0;
	var anger_counter = 0;
	var anger_agree = 0;
	var happiness_disagree = 0;
	var anger_influenced = false;
	var happiness_influenced = false;
	var next_move = 0;
	
	var myLastMove = PD.COOPERATE;
	
	self.mood = function(){
		return mood_;
	}	
	self.play = function(){
				//If we are 5 moves away from having cheated a happy negotiator...
		if (happiness_counter > 4){
			happiness_counter = 0;
			//if they admonished us by disagreeing more than 2/5 times
			if (happiness_disagree > 2){
				//we know not to be influened by the happiness rule anymore
				//because they've discovered we're taking advantage of their
				//happiness.
				happiness_influenced = false;
			}
			happiness_disagree = 0;
		}
		//if we are 6 moves away from capitulating to an angry negotiator
		if (anger_counter > 5){
			anger_counter = 0;
			//if they have not reciprocated at least 2/6 times...
			if (anger_agree < 3){
				//we know they are irrationally crazy, and won't return the
				//favor even if we capitulate. So, ignore the anger rule.
				anger_influenced = false;
			}
			anger_agree = 0;
		}

		toReturn =  myLastMove;
		if (next_move != 0 && next_move != toReturn && happiness_influenced
			&& anger_influenced){
			return next_move;
		}		
		return toReturn;

	};
	self.remember = function(own, other, other_mood){
		next_move = should_change(other_mood);

		myLastMove = own; // remember MISTAKEN move
		if(other==PD.CHEAT) myLastMove = ((myLastMove==PD.COOPERATE) ? PD.CHEAT : PD.COOPERATE); // switch!
		if (next_move == PD.CHEAT) happiness_counter++;
		if (next_move == PD.COOPERATE) anger_counter++;

	};
}

// TEST by Cooperate | Cheat | Cooperate | Cooperate
// If EVER retaliates, keep playing TFT
// If NEVER retaliates, switch to ALWAYS DEFECT
function Logic_prober(){

	var self = this;
	var mood_ = getRandomInt(-10, 6);
	var happiness_counter = 0;
	var anger_counter = 0;
	var anger_agree = 0;
	var happiness_disagree = 0;
	var anger_influenced = false;
	var happiness_influenced = false;
	var next_move = 0;
	
	var moves = [PD.COOPERATE, PD.CHEAT, PD.COOPERATE, PD.COOPERATE];
	var everCheatedMe = false;

	var otherMove = PD.COOPERATE;
	self.mood = function(){
		return mood_;
	}
	self.play = function(){
		//If we are 5 moves away from having cheated a happy negotiator...
		if (happiness_counter > 4){
			happiness_counter = 0;
			//if they admonished us by disagreeing more than 2/5 times
			if (happiness_disagree > 2){
				//we know not to be influened by the happiness rule anymore
				//because they've discovered we're taking advantage of their
				//happiness.
				happiness_influenced = false;
			}
			happiness_disagree = 0;
		}
		//if we are 6 moves away from capitulating to an angry negotiator
		if (anger_counter > 5){
			anger_counter = 0;
			//if they have not reciprocated at least 2/6 times...
			if (anger_agree < 3){
				//we know they are irrationally crazy, and won't return the
				//favor even if we capitulate. So, ignore the anger rule.
				anger_influenced = false;
			}
			anger_agree = 0;
		}


		toReturn = 0;
		if(moves.length>0){
			// Testing phase
			var move = moves.shift();
			toReturn = move;
		}else{
			if(everCheatedMe){
				toReturn = otherMove; // TFT
			}else{
				toReturn = PD.CHEAT; // Always Cheat
			}
		}
		
		if (next_move != 0 && next_move != toReturn && happiness_influenced
			&& anger_influenced){
			return next_move;
		}		
		return toReturn;
		
	};
	self.remember = function(own, other, other_mood){
		next_move = should_change(other_mood);

		if(moves.length>0){
			if(other==PD.CHEAT) everCheatedMe=true; // Testing phase: ever retaliated?
		}
		otherMove = other; // for TFT
		
		if (next_move == PD.CHEAT) happiness_counter++;
		if (next_move == PD.COOPERATE) anger_counter++;

	};

}
