users table:

users
No description available


Language: Javascript
Columns

Name	Format	Type	Description
id	
uuid

string	
email	
character varying

string	
auth_provider	
character varying

string	
created_at	
timestamp with time zone

string	
last_login	
timestamp with time zone

string	
profile_completed	
boolean

boolean	
display_name	
character varying

string	
timezone	
character varying

string	

user_progress table

user_progress
No description available


Language: Javascript
Columns

Name	Format	Type	Description
id	
uuid

string	
user_id	
uuid

string	
level	
integer

number	
xp	
integer

number	
max_xp	
integer

number	
streak_count	
integer

number	
last_streak_update	
timestamp with time zone

string	
total_points	
integer

number	
highest_streak	
integer

number	


sessions table:

sessions
No description available


Language: Javascript
Columns

Name	Format	Type	Description
id	
uuid

string	
user_id	
uuid

string	
exercise_id	
integer

number	
duration	
integer

number	
start_time	
timestamp with time zone

string	
end_time	
timestamp with time zone

string	
focus_increase	
integer

number	
xp_gained	
integer

number	
completed_exercises_count	
integer

number	
performance_metrics	
jsonb

json	
questions_answered	
integer

number	
correct_answers	
integer

number	
score_percent	
integer

number	
quiz_details	
jsonb

json


reading_progress table

reading_progress
No description available


Language: Javascript
Columns

Name	Format	Type	Description
id	
integer

number	
user_id	
uuid

string	
book_id	
integer

number	
words_flashed	
integer

number	
word_count	
integer

number	
last_position	
integer

number	
created_at	
timestamp with time zone

string	
updated_at	
timestamp with time zone

string

library table:

library
No description available


Language: Javascript
Columns

Name	Format	Type	Description
id	
integer

number	
title	
character varying

string	
description	
text

string	
content	
text

string	
length	
integer

number	
estimated_time	
character varying

string	
created_at	
timestamp with time zone

string	
updated_at	
timestamp with time zone

string


exercises table:

exercises
No description available


Language: Javascript
Columns

Name	Format	Type	Description
id	
integer

number	
name	
character varying

string	
type	
character varying

string	
duration	
integer

number	
difficulty_level	
integer

number	
description	
text

string	
instructions	
jsonb

json	
required_level	
integer

number	
xp_reward	
integer

number	
focus_reward	
integer

number	
is_unlocked	
boolean

boolean	
